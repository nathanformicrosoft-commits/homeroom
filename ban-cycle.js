const { createClient } = require('@supabase/supabase-js');
const { Rcon } = require('rcon-client');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const rconHost = process.env.RCON_HOST;
const rconPort = parseInt(process.env.RCON_PORT, 10);
const rconPassword = process.env.RCON_PASSWORD;

// ⚠️ CHANGE THIS TO YOUR EXACT MINECRAFT USERNAME!
const ADMIN_NAME = "kurayamisuna"; 

async function run() {
  const now = new Date();
  // GitHub runs in UTC. Philippines is UTC+8, so we add 8 hours.
  const localNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const day = localNow.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
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
    // 1. WEEKDAYS (Mon-Fri) at 1:00 AM: AUTO-BAN EVERYONE ONLINE
    const isWeekday = day >= 1 && day <= 5;
    const isOneAm = hour === 1 && minute < 30; // Runs between 1:00 AM and 1:29 AM
    
    // Check Supabase to ensure we only ban once per day
    const todayStr = localNow.toDateString();
    const { data: banLog } = await supabase.from('kv').select('value').eq('key', 'last_ban_date').single();
    const lastBanDate = banLog ? banLog.value.date : '';

    if (isWeekday && isOneAm && lastBanDate !== todayStr) {
      console.log(`[McBanCycle] It's ${hour}:${minute} AM on a weekday! Scanning for online players to ban...`);
      
      // Get the list of online players
      const listResponse = await rcon.send("list");
      console.log("Server list response:", listResponse);

      // Parse the player names from the list output
      let playersToBan = [];
      const lines = listResponse.split('\n');
      for (let line of lines) {
        if (line.includes(':')) {
          const namesPart = line.split(':')[1];
          const names = namesPart.split(',').map(n => n.trim()).filter(n => n.length > 0);
          playersToBan.push(...names);
        }
      }

      if (playersToBan.length === 0) {
        console.log("[McBanCycle] No players online to ban.");
      } else {
        console.log(`[McBanCycle] Found ${playersToBan.length} players online.`);
        for (const player of playersToBan) {
          // Skip the admin so you don't lock yourself out!
          if (player.toLowerCase() === ADMIN_NAME.toLowerCase()) {
            console.log(`🛡️ Skipping admin: ${player}`);
            continue;
          }
          
          try {
            const reason = "Homeroom tasks not completed. Request access via the website!";
            await rcon.send(`ban ${player} ${reason}`);
            console.log(`🔨 Auto-banned: ${player}`);
          } catch (e) {
            console.log(`⚠️ Could not ban ${player} (might already be banned)`);
          }
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
        await rcon.send("pardon-all"); 
      } catch(e) { 
        console.log("pardon-all command not supported, skipping weekend mass-unban.");
      }
      return; 
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
