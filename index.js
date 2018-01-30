const DiscordClient = require('eris');
const needle = require('needle');
const chrono = require('chrono-node');
const Fuse = require('fuse.js');
const {logs, LogLevel} = require('./logs.js');

const usedLogLevel = LogLevel[process.env.BOT_LOG_LEVEL] || LogLevel.INFO;
logs.setLevel(usedLogLevel);
logs.info(`Log level ${usedLogLevel.prefix}.`);

logs.info('Loading configuration...');
const conf = {};
for (const key of ['url', 'token']) {
  conf[key] = process.env[`BOT_${key.toUpperCase()}`];
  if (!conf[key]) throw new Error(`Expected env var BOT_${key.toUpperCase}!`);
}

const helpText = `__Introducing... **ArrayButt!**__
A revolution in philosophy!
Invoke me with \`[]says [date|query]\``;
const months = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
function choose(collection) {
  return collection[Math.floor(Math.random() * collection.length)];
}

const reqDelay = parseInt(process.env.BOT_REQ_DELAY, 10) || 1000 * 60 * 30;
let lastReq = -1, cached = null;
async function getQuotes() {
  const currentTime = Date.now();
  if (!cached || currentTime - lastReq >= reqDelay) {
    logs.info('Cache expired! Re-fetching quote DB...');
    lastReq = currentTime;
    try {
      cached = (await needle('get', conf.url)).body;
    } catch (e) {
      logs.warn('Cache refresh failed!');
      logs.warn(e);
    }
  }
  return cached;
}

needle.defaults({
  follow: 3,
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36',
});

logs.info('Creating Discord client...');
const client = new DiscordClient(conf.token);
let authTime, commandMatcher;

client.on('ready', async () => {
  commandMatcher = new RegExp(`(?:\\[]says|<@!?${client.user.id}>)(?:\\s+(.*))?`, 'i');
  logs.info(`Authenticated successfully in ${Date.now() - authTime} ms.`);
});

async function sendQuote(msg, quote, month, year) {
  await msg.channel.createMessage({
    embed: {
      description: quote,
      color: 0x2196F3,
      footer: {
        icon_url: 'https://avatars1.githubusercontent.com/u/16021050?s=460&v=4',
        text: `Arraying, ${months[month - 1]} ${year}`,
      },
    },
  });
}

async function doCommand(msg, args) {
  const quotes = await getQuotes();
  if (args) {
    let date = chrono.parse(args);
    if (date.length) {
      let vals = {};
      for (const dateElem of date) vals = {...vals, ...dateElem.start.knownValues};
      if (vals.month) {
        const year = vals.year || (new Date()).getUTCFullYear();
        if (!quotes[year]) {
          await msg.channel.createMessage(`No results found for year \`${year}\`.`);
        } else {
          if (!quotes[year][vals.month]) {
            await msg.channel.createMessage(`No results found for ${months[vals.month - 1]} of ${year}.`);
          } else {
            const quote = choose(quotes[year][vals.month]);
            await sendQuote(msg, quote, vals.month, year);
          }
        }
      } else if (vals.year) {
        if (!quotes[vals.year]) {
          await msg.channel.createMessage(`No results found for year \`${vals.year}\`.`);
        } else {
          const quoteArr = [];
          for (const month of Object.keys(quotes[vals.year])) {
            for (const quote of quotes[vals.year][month]) quoteArr.push({month, quote});
          }
          const quote = choose(quoteArr);
          await sendQuote(msg, quote.quote, parseInt(quote.month, 10), vals.year);
        }
      }
    } else {
      const quoteArr = [];
      for (const year of Object.keys(quotes)) {
        for (const month of Object.keys(quotes[year])) {
          for (const quote of quotes[year][month]) quoteArr.push({year, month, quote});
        }
      }
      const search = new Fuse(quoteArr, {
        keys: ['quote'],
        threshold: 0.8,
        maxPatternLength: 16,
      });
      const matches = search.search(args);
      if (matches.length) {
        const quote = choose(matches);
        await sendQuote(msg, quote.quote, parseInt(quote.month, 10), quote.year);
      } else {
        await msg.channel.createMessage(`No results found for query \`${args}\`.`);
      }
    }
  } else {
    const year = choose(Object.keys(quotes));
    const month = choose(Object.keys(quotes[year]));
    const quote = choose(quotes[year][month]);
    await sendQuote(msg, quote, parseInt(month, 10), year);
  }
}

client.on('messageCreate', async msg => {
  if (!msg.author.bot && msg.content) {
    let match = commandMatcher.exec(msg.content);
    if (msg.guild) {
      if (match) {
        await doCommand(msg, match[1]);
      }
    } else if (match) {
      await doCommand(msg, match[1]);
    } else {
      await msg.channel.createMessage(helpText);
    }
  }
});

(async function() {
  await getQuotes();
  logs.info('Authenticating...');
  authTime = Date.now();
  client.connect();
})();