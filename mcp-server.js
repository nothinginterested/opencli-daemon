#!/usr/bin/env node
'use strict';

const http = require('http');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Active SSE sessions: sessionId -> res
const sessions = new Map();

function runOpencli(args, timeoutMs = 30000) {
  try {
    const output = execSync(`opencli ${args}`, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      env: { ...process.env },
    });
    return { success: true, text: output };
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || 'unknown error').toString();
    return { success: false, text: msg };
  }
}

const TOOLS = [
  {
    name: 'opencli_run',
    description:
      'Run an opencli command against 60+ websites (Bilibili, Zhihu, Twitter, Reddit, HackerNews, etc.). ' +
      'Examples: "bilibili hot -f json", "zhihu hot", "hackernews top --limit 10", "v2ex hot -f json". ' +
      'Use opencli_list first to see all available adapters.',
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'string',
          description: 'opencli arguments, e.g. "bilibili hot -f json"',
        },
      },
      required: ['args'],
    },
  },
  {
    name: 'opencli_list',
    description: 'List all available opencli adapters / commands.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['table', 'json', 'yaml'],
          description: 'Output format (default: table)',
        },
      },
    },
  },
];

function sendSSE(sse, data) {
  if (sse && !sse.destroyed) {
    sse.write(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

function handleMessage(msg, sse) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    sendSSE(sse, {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'opencli-mcp', version: '1.0.0' },
      },
    });
  } else if (method === 'notifications/initialized') {
    // no response required
  } else if (method === 'ping') {
    sendSSE(sse, { jsonrpc: '2.0', id, result: {} });
  } else if (method === 'tools/list') {
    sendSSE(sse, { jsonrpc: '2.0', id, result: { tools: TOOLS } });
  } else if (method === 'tools/call') {
    const { name, arguments: args = {} } = params;
    let result;
    if (name === 'opencli_list') {
      const fmt = args.format || 'table';
      result = runOpencli(`list -f ${fmt}`, 10000);
    } else if (name === 'opencli_run') {
      result = runOpencli(args.args);
    } else {
      result = { success: false, text: `Unknown tool: ${name}` };
    }
    sendSSE(sse, {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: result.text }],
        isError: !result.success,
      },
    });
  } else {
    // unknown method
    sendSSE(sse, {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }
}

const STATUS_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>OpenCLI MCP</title>
<style>body{font-family:monospace;max-width:700px;margin:40px auto;padding:0 20px}
code{background:#f0f0f0;padding:2px 6px;border-radius:3px}
pre{background:#f0f0f0;padding:12px;border-radius:6px;overflow-x:auto}</style>
</head><body>
<h1>OpenCLI MCP Server</h1>
<p>Status: <strong style="color:green">Running</strong></p>
<hr>
<h2>Add to Claude Code</h2>
<pre>claude mcp add opencli -s user --transport sse https://YOUR_DOMAIN/sse</pre>
<h2>SSH Tunnel (for Chrome Extension)</h2>
<pre>ssh -L 19825:localhost:19825 user@your-lazycat-ip</pre>
<p>Then install the opencli Browser Bridge extension in Chrome.</p>
<hr>
<p>MCP SSE endpoint: <code>/sse</code> &nbsp;|&nbsp; Messages: <code>POST /messages?sessionId=...</code></p>
</body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // SSE subscription endpoint
  if (req.method === 'GET' && url.pathname === '/sse') {
    const sessionId = crypto.randomUUID();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    // Tell client where to POST messages
    res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

    sessions.set(sessionId, res);
    const keepalive = setInterval(() => {
      if (res.destroyed) { clearInterval(keepalive); return; }
      res.write(': ping\n\n');
    }, 15000);
    req.on('close', () => {
      clearInterval(keepalive);
      sessions.delete(sessionId);
    });
    return;
  }

  // JSON-RPC message endpoint
  if (req.method === 'POST' && url.pathname === '/messages') {
    const sessionId = url.searchParams.get('sessionId');
    const sse = sessions.get(sessionId);

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end('{}');
      try {
        const msg = JSON.parse(body);
        handleMessage(msg, sse);
      } catch (e) {
        console.error('Failed to parse message:', e.message);
      }
    });
    return;
  }

  // Status page
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(STATUS_HTML);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(3000, '0.0.0.0', () => {
  console.log('[opencli-mcp] MCP SSE server listening on :3000');
  console.log('[opencli-mcp] SSE endpoint: http://localhost:3000/sse');
});
