const { createClient } = require('@supabase/supabase-js');
const { Rcon } = require('rcon-client');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const rconHost = process.env.RCON_HOST;
const rconPort = parseInt(process.env.RCON_PORT, 10);
const rconPassword = process.env.RCON_PASSWORD;

// ADD YOUR CLASSMATES' MINECRAFT USERNAMES HERE!
const STUDENTS_TO_BAN = [
  "Fr0zennz",
  "Luvonoqs",
  "jarredpogi",
  "Ryuichiio"
];

async function run() {
  const now = new Date();
  // GitHub runs in UTC. Philippines is UTC+8, so we add 8 hours.
  const localNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const day = localNow.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = localNow.getHours();
  const minute = localNow.getMinutes();

  console.log(`[McBanCycle] Running check: Local Day ${day}, Time ${hour}:${minute}`);

  let rcon;
  try {
    rcon = await Rcon.connect({ host: rconHost, port: rconPort, password: rconPassword });
    console.log("[McBanCycle] Connected to Minecraft RCON.");
  } catch (err) {
    console.error("[McBanCycle] RCON Connection Failed. Full error details:");
    console.error(err);
    process.exit(1);
  }

  try {
    // 1. WEEKDAYS (Mon-Fri) at 1:00 AM: AUTO-BAN STUDENTS
    // We check if it's between 1:00 AM and 1:29 AM to ensure it runs, but only once per day.
    const isWeekday = day >= 1 && day <= 5;
    const isOneAm = hour === 1 && minute < 30; 
    
    // We use Supabase to track if we already banned them today to prevent spamming the ban command
    const todayStr = localNow.toDateString();
    const { data: banLog } = await supabase.from('kv').select('value').eq('key', 'last_ban_date').single();
    const lastBanDate = banLog ? banLog.value.date : '';

    if (isWeekday && isOneAm && lastBanDate !== todayStr) {
      console.log(`[McBanCycle] It's ${hour}:${minute} AM on a weekday! Auto-banning students...`);
      
      for (const student of STUDENTS_TO_BAN) {
        try {
          // Ban the student with a custom reason
          await rcon.send(`ban ${student} Homeroom tasks not completed. See you next week!`);
          console.log(`[McBanCycle] Banned: ${student}`);
        } catch (e) {
          console.log(`[McBanCycle] Could not ban ${student} (might already be banned)`);
        }
      }
      
      // Record that we banned them today so it doesn't happen again until tomorrow
      await supabase.from('kv').upsert({ key: 'last_ban_date', value: { date: todayStr } });
      console.log("[McBanCycle] Auto-ban cycle complete for today.");
    }

    // 2. SATURDAY & SUNDAY (Day 6 and 0): FREE PLAY (Unban everyone)
    if (day === 6 || day === 0) {
      console.log("[McBanCycle] Weekend: Unbanning everyone for free play!");
      try { 
        // Essentials command to unban everyone
        await rcon.send("pardon-all"); 
      } catch(e) { 
        console.log("pardon-all failed, unbanning students individually...");
        for (const student of STUDENTS_TO_BAN) {
            await rcon.send(`pardon ${student}`);
        }
      }
      
      // Reset their status in the database to 'banned' so the weekday logic knows they need to earn it again
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
      return; // Exit early, no need to check tasks on weekends
    }

    // 3. WEEKDAYS (Mon-Fri) 1:30 AM onwards: CHECK TASKS FOR UNBAN
    if (hour >= 1 && minute >= 30) {
      console.log("[McBanCycle] Weekday: Checking task completions for unban...");
      const { data: records } = await supabase.from('kv').select('key, value').like('key', 'mc:%');
      
      if (records) {
        for (const row of records) {
          const val = row.value;
          if (val.status === 'unbanned') continue;

          const total = val.total || 0;
          const done = val.done || 0;

          // If they finished EVERYTHING
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
