// ==========================================
// MULTI-SHEET TELEGRAM BOT WITH CLAUDE AI
// Complete Working Code
// ==========================================

// FILE 1: package.json
/*
{
  "name": "multi-sheet-telegram-bot",
  "version": "1.0.0",
  "description": "Telegram bot that reads multiple Google Sheets and answers questions with Claude AI",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "engines": {
    "node": "18.x"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "google-auth-library": "^9.0.0",
    "googleapis": "^118.0.0",
    "telegraf": "^4.14.0"
  }
}
*/

// ==========================================
// FILE 2: .env (Create and fill with your values)
/*
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER
TELEGRAM_USER_ID=YOUR_USER_ID
CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxxx

GOOGLE_SHEET_ID_1=YOUR_SHEET_ID
GOOGLE_SHEET_ID_2=YOUR_SHEET_ID
GOOGLE_SHEET_ID_3=YOUR_SHEET_ID

GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=xxxx
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@iam.gserviceaccount.com
GOOGLE_CLIENT_ID=xxxx

PORT=3000
WEBHOOK_URL=https://your-railway-url.railway.app
NODE_ENV=production
*/

// ==========================================
// FILE 3: index.js (Main Bot Code)
// ==========================================

const { Telegraf } = require('telegraf');
const axios = require('axios');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');

dotenv.config();

console.log('🚀 Starting Multi-Sheet Telegram Bot...');

// ==========================================
// INITIALIZE
// ==========================================

const app = express();
app.use(bodyParser.json());

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_USER_ID);

console.log(`✅ Bot initialized`);
console.log(`📱 Allowed User ID: ${ALLOWED_USER_ID}`);

// Initialize Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ==========================================
// CONFIGURE YOUR SHEETS HERE
// ==========================================

const SHEETS_CONFIG = {
  sheet1: {
    id: process.env.GOOGLE_SHEET_ID_1,
    name: 'Daily Book (Expenses)',
    description: 'All daily expenses and transactions',
    range: 'Sheet1!A:Z'
  },
  sheet2: {
    id: process.env.GOOGLE_SHEET_ID_2,
    name: 'Budget',
    description: 'Budget allocations by category',
    range: 'Sheet1!A:Z'
  },
  sheet3: {
    id: process.env.GOOGLE_SHEET_ID_3,
    name: 'Categories',
    description: 'Category details and information',
    range: 'Sheet1!A:Z'
  }
};

// ==========================================
// AUTHORIZATION CHECK
// ==========================================

function isAuthorized(ctx) {
  const authorized = ctx.from.id === ALLOWED_USER_ID;
  if (!authorized) {
    console.log(`❌ Unauthorized access attempt from user: ${ctx.from.id}`);
  }
  return authorized;
}

// ==========================================
// READ GOOGLE SHEETS (MULTIPLE SHEETS)
// ==========================================

async function readAllSheets() {
  try {
    console.log(`📖 Reading all configured sheets...`);
    
    const allSheetsData = {};
    
    // Read each configured sheet
    for (const [key, config] of Object.entries(SHEETS_CONFIG)) {
      try {
        console.log(`   Reading: ${config.name}`);
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: config.id,
          range: config.range,
        });

        const rows = response.data.values || [];
        
        allSheetsData[key] = {
          name: config.name,
          description: config.description,
          data: rows,
          rowCount: rows.length,
          columnCount: rows[0]?.length || 0
        };
        
        console.log(`   ✓ ${config.name}: ${rows.length} rows`);
      } catch (error) {
        console.error(`   ✗ Error reading ${config.name}:`, error.message);
        allSheetsData[key] = {
          name: config.name,
          description: config.description,
          data: [],
          error: error.message
        };
      }
    }

    console.log(`✅ All sheets read successfully`);
    return allSheetsData;
  } catch (error) {
    console.error('❌ Error reading sheets:', error);
    throw error;
  }
}

// ==========================================
// FORMAT DATA FOR CLAUDE
// ==========================================

function formatSheetsForClaude(allSheetsData) {
  let formattedText = '📊 MULTIPLE SHEETS DATA:\n\n';
  
  for (const [key, sheetData] of Object.entries(allSheetsData)) {
    formattedText += `\n${'='.repeat(60)}\n`;
    formattedText += `📄 SHEET: ${sheetData.name}\n`;
    formattedText += `Description: ${sheetData.description}\n`;
    formattedText += `Rows: ${sheetData.rowCount} | Columns: ${sheetData.columnCount}\n`;
    formattedText += `${'='.repeat(60)}\n\n`;
    
    if (sheetData.error) {
      formattedText += `⚠️ Error reading this sheet: ${sheetData.error}\n\n`;
      continue;
    }
    
    const rows = sheetData.data;
    if (rows.length === 0) {
      formattedText += `(No data in this sheet)\n\n`;
      continue;
    }
    
    // Headers
    const headers = rows[0];
    formattedText += `Headers: ${headers.join(' | ')}\n\n`;
    
    // Data rows
    formattedText += `Data:\n`;
    rows.slice(1).forEach((row, idx) => {
      const rowData = headers
        .map((header, i) => `${header}=${row[i] || 'N/A'}`)
        .join(', ');
      formattedText += `Row ${idx + 1}: ${rowData}\n`;
    });
    
    formattedText += '\n';
  }
  
  return formattedText;
}

// ==========================================
// CLAUDE AI ANALYSIS
// ==========================================

async function askClaudeAboutSheets(question, sheetsData) {
  try {
    console.log(`🧠 Asking Claude: "${question}"`);

    const formattedData = formatSheetsForClaude(sheetsData);
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-20250805',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `You are a data analyst helping someone understand their financial data from multiple Google Sheets.

Here are ${Object.keys(sheetsData).length} different sheets with their data:

${formattedData}

User question: ${question}

Please analyze this data and provide a clear, helpful answer. You can:
1. Reference data from any single sheet
2. Connect data across multiple sheets
3. Find patterns and trends
4. Make calculations and comparisons
5. Provide recommendations

Be specific with numbers and explain your reasoning. Keep response concise but thorough.`
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const answer = response.data.content[0].text;
    console.log(`✅ Claude responded`);
    return answer;
  } catch (error) {
    console.error('❌ Error calling Claude:', error.message);
    if (error.response?.data) {
      console.error('Claude error:', error.response.data);
    }
    throw new Error('Claude API Error: ' + error.message);
  }
}

// ==========================================
// BOT COMMANDS
// ==========================================

// START COMMAND
bot.start(async (ctx) => {
  if (!isAuthorized(ctx)) {
    console.log(`🚫 Unauthorized /start attempt`);
    return ctx.reply('❌ Unauthorized. This bot is private.');
  }

  console.log(`👤 User started bot: ${ctx.from.first_name}`);

  const message = `👋 Welcome to Multi-Sheet Data Bot!

I have access to ${Object.keys(SHEETS_CONFIG).length} sheets:
${Object.values(SHEETS_CONFIG).map(s => `📄 ${s.name}`).join('\n')}

📊 **What I can do:**
• Analyze data from any sheet
• Connect information across multiple sheets
• Answer questions about your data
• Find patterns and trends
• Make recommendations

💬 **Just ask me anything:**
"What are my total expenses?"
"Compare my spending vs budget"
"Which category am I overspending in?"
"Show me spending patterns"
"How much did I spend on food?"

**Commands:**
/help - Show help
/sheets - List available sheets
/analyze - Full data analysis
/summary - Quick summary

Start by asking a question! 😊`;

  ctx.reply(message);
});

// HELP COMMAND
bot.command('help', (ctx) => {
  if (!isAuthorized(ctx)) {
    return ctx.reply('❌ Unauthorized.');
  }

  const help = `📚 **Available Commands:**

/start - Welcome message
/help - This help message
/sheets - Show available sheets
/analyze - Full data analysis
/summary - Quick summary

💡 **Or just ask questions:**
"What's my balance?"
"Compare categories"
"Show top expenses"
"Am I under budget?"
"Where am I overspending?"

I can analyze data across ALL your sheets!`;

  ctx.reply(help);
});

// SHEETS COMMAND
bot.command('sheets', (ctx) => {
  if (!isAuthorized(ctx)) {
    return ctx.reply('❌ Unauthorized.');
  }

  let sheetsInfo = '📊 **Available Sheets:**\n\n';
  
  Object.entries(SHEETS_CONFIG).forEach(([key, config], idx) => {
    sheetsInfo += `${idx + 1}. **${config.name}**\n`;
    sheetsInfo += `   ${config.description}\n\n`;
  });
  
  sheetsInfo += `I can read from ALL these sheets simultaneously and answer cross-sheet questions!`;
  
  ctx.reply(sheetsInfo);
});

// ANALYZE COMMAND
bot.command('analyze', async (ctx) => {
  if (!isAuthorized(ctx)) {
    return ctx.reply('❌ Unauthorized.');
  }

  try {
    console.log(`📊 /analyze command received`);
    ctx.reply('🔍 Analyzing all your data... (this may take a moment)');

    const sheetsData = await readAllSheets();
    
    const analysis = await askClaudeAboutSheets(
      'Provide a comprehensive analysis of all this data. Include: total amounts, top categories, comparisons between sheets, spending patterns, and 3 key recommendations.',
      sheetsData
    );

    ctx.reply('📊 **Full Data Analysis:**\n\n' + analysis);
  } catch (error) {
    console.error('Error in /analyze:', error);
    ctx.reply('❌ Error: ' + error.message);
  }
});

// SUMMARY COMMAND
bot.command('summary', async (ctx) => {
  if (!isAuthorized(ctx)) {
    return ctx.reply('❌ Unauthorized.');
  }

  try {
    console.log(`📈 /summary command received`);
    ctx.reply('📈 Getting summary...');

    const sheetsData = await readAllSheets();
    
    const summary = await askClaudeAboutSheets(
      'Give a brief summary: (1) Total from each sheet, (2) Main insights, (3) One key recommendation.',
      sheetsData
    );

    ctx.reply('📊 **Summary:**\n\n' + summary);
  } catch (error) {
    console.error('Error in /summary:', error);
    ctx.reply('❌ Error: ' + error.message);
  }
});

// ==========================================
// HANDLE TEXT MESSAGES (USER ASKS QUESTIONS)
// ==========================================

bot.on('text', async (ctx) => {
  if (!isAuthorized(ctx)) {
    console.log(`🚫 Unauthorized message from: ${ctx.from.id}`);
    return ctx.reply('❌ Unauthorized. This bot is private.');
  }

  const userMessage = ctx.message.text;
  console.log(`💬 User message: "${userMessage}"`);

  // Don't respond to commands (they're handled separately)
  if (userMessage.startsWith('/')) {
    return;
  }

  try {
    // Show typing indicator
    await ctx.sendChatAction('typing');

    // Read all sheets
    const sheetsData = await readAllSheets();

    // Ask Claude
    const response = await askClaudeAboutSheets(userMessage, sheetsData);

    // Send response
    ctx.reply(response);
  } catch (error) {
    console.error('Error processing message:', error);
    ctx.reply('❌ Error: ' + error.message);
  }
});

// ==========================================
// ERROR HANDLING
// ==========================================

bot.catch((err, ctx) => {
  console.error('🚨 Bot error:', err);
  try {
    ctx.reply('❌ An error occurred. Please try again.');
  } catch (e) {
    console.error('Could not send error message:', e);
  }
});

// ==========================================
// EXPRESS SERVER FOR WEBHOOK
// ==========================================

// Webhook endpoint
app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    bot: 'Running',
    sheets: Object.keys(SHEETS_CONFIG).length,
    timestamp: new Date(),
    authorized_user: ALLOWED_USER_ID
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Multi-Sheet Telegram Bot is running',
    sheets: Object.values(SHEETS_CONFIG).map(s => s.name),
    commands: [
      '/start - Welcome',
      '/help - Help',
      '/sheets - List sheets',
      '/analyze - Full analysis',
      '/summary - Quick summary'
    ]
  });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`\n🤖 ============================================`);
  console.log(`🤖 MULTI-SHEET TELEGRAM BOT STARTED`);
  console.log(`🤖 ============================================\n`);
  console.log(`📱 Port: ${PORT}`);
  console.log(`🔗 Webhook URL: ${process.env.WEBHOOK_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`);
  console.log(`👤 Authorized User: ${ALLOWED_USER_ID}`);
  console.log(`📊 Sheets configured: ${Object.keys(SHEETS_CONFIG).length}`);
  
  Object.entries(SHEETS_CONFIG).forEach(([key, config]) => {
    console.log(`   • ${config.name}`);
  });
  
  console.log(`🧠 Claude AI: Enabled`);

  // Set webhook for Telegram
  try {
    await bot.telegram.setWebhook(
      `${process.env.WEBHOOK_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`
    );
    console.log(`\n✅ Webhook set successfully`);
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
  }

  console.log(`\n📱 Available Commands:`);
  console.log(`   /start - Initialize bot`);
  console.log(`   /help - Show help`);
  console.log(`   /sheets - List available sheets`);
  console.log(`   /analyze - Full analysis`);
  console.log(`   /summary - Quick summary`);
  console.log(`   Or just type any question!\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down bot...');
  await bot.stop();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
});

console.log('✅ Bot code loaded and ready');

