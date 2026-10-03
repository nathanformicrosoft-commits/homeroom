const { createClient } = require('@supabase/supabase-js');
const { Rcon } = require('rcon-client');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const rconHost = process.env.RCON_HOST;
const rconPort = parseInt(process.env.RCON_PORT, 10);
const rconPassword = process.env.RCON_PASSWORD;

async function run() {
  const now = new Date();
  // GitHub runs in UTC. Philippines is UTC+8, so we add 8 hours.
  const localNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const day = localNow.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = localNow.getHours();

  console.log(`[McBanCycle] Running check: Local Day ${day}, Hour ${hour}`);

  let rcon;
  try {
    rcon = await Rcon.connect({ host: rconHost, port: rconPort, password: rconPassword });
    console.log("[McBanCycle] Connected to Minecraft RCON.");
       } catch (err) {
       console.error("[McBanCycle] RCON Connection Failed. Full error details:");
       console.error(err);
       process.exit(1);
     }
  }

  try {
    // 1. SUNDAY 12:00 AM: WEEKLY RESET
    if (day === 0 && hour === 0) {
      console.log("[McBanCycle] Sunday 12 AM: Resetting all requests to 'banned'.");
      const { data: records } = await supabase.from('kv').select('key, value').like('key', 'mc:%');
      if (records) {
        for (const row of records) {
          const val = row.value;
          if (val.status !== 'banned') {
            val.status = 'banned';
            await supabase.from('kv').update({ value: val }).eq('key', row.key);
          }
        }
      }
      return;
    }

    // 2. SATURDAY & SUNDAY: FREE PLAY (Unban everyone)
    if (day === 6 || day === 0) {
      console.log("[McBanCycle] Weekend: Unbanning everyone.");
      try { await rcon.send("pardon-all"); } catch(e) { console.log("pardon-all failed, might not be supported by your server"); }
      
      const { data: records } = await supabase.from('kv').select('key, value').like('key', 'mc:%');
      if (records) {
        for (const row of records) {
          const val = row.value;
          if (val.status !== 'unbanned') {
            val.status = 'unbanned';
            await supabase.from('kv').update({ value: val }).eq('key', row.key);
          }
        }
      }
      return;
    }

    // 3. WEEKDAYS (Mon-Fri) 1 AM onwards: CHECK TASKS
    if (hour >= 1) {
      console.log("[McBanCycle] Weekday: Checking task completions.");
      const { data: records } = await supabase.from('kv').select('key, value').like('key', 'mc:%');
      
      if (records) {
        for (const row of records) {
          const val = row.value;
          if (val.status === 'unbanned') continue;

          const total = val.total || 0;
          const done = val.done || 0;

          if (total > 0 && done >= total) {
            console.log(`[McBanCycle] Unbanning ${val.mcName} (Done: ${done}/${total})`);
            
            await rcon.send(`pardon ${val.mcName}`);
            if (val.friends && val.friends.length > 0) {
              for (const friend of val.friends) {
                await rcon.send(`pardon ${friend.name}`);
              }
            }

            val.status = 'unbanned';
            await supabase.from('kv').update({ value: val }).eq('key', row.key);
          }
        }
      }
    }
  } catch (err) {
    console.error(`[McBanCycle] Error during cycle: ${err.message}`);
  } finally {
    if (rcon) {
      await rcon.end();
      console.log("[McBanCycle] RCON connection closed.");
    }
  }
}

run();
