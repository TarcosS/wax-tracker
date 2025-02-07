import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';
import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { createDfuseClient } from "@dfuse/client"
import nfetch from 'node-fetch';
import ws from 'ws';

global.fetch = nfetch;
global.WebSocket = ws;

const client = createDfuseClient({
  apiKey: 'e8a6dcbd807cb69977c3cf8b976098e5',
  network: "wax.dfuse.eosnation.io",
})

// You must use a $cursor variable so stream starts back at last marked cursor on reconnect!
const operation = `subscription ($cursor: String) {
  searchTransactionsForward(
    query: "(account:eosio.token) (action:transfer OR action:buy)",
    cursor: $cursor
  ) {
    undo cursor
    block { num id }
    trace {
      id
      matchingActions {
        seq
        receiver account name
        json
        dbOps { operation oldJSON { object error } newJSON { object error } }
        dtrxOps { operation payer transaction { actions { account name json } } }
        ramOps { operation delta usage }
      }
    }
  }
}`


await client.release()
// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }
    if (name === 'watch_wax') {
      const stream = await client.graphql(operation, (message) => {
        if (message.type === "data") {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // Fetches a random emoji to send from a helper function
              content: message.data.searchTransactionsForward.trace.matchingActions.json.memo,
            },
          });
        }
      
      });
      await stream.join()
    }
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
