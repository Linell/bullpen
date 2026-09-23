import { DuckDBInstance } from "@duckdb/node-api";

async function query() {
  const url = "md:bullpen-prod";
  console.log("Connecting to", url);
  
  try {
    const instance = await DuckDBInstance.fromCache(url);
    const conn = await instance.connect();
    
    try {
      // Query 1: Teams for team_id 141 and 110
      console.log("\n=== Query 1: Teams (id 141 and 110) ===");
      const teams = await conn.query(
        "SELECT * FROM teams WHERE team_id IN (141, 110) ORDER BY team_id"
      );
      console.log("Teams rows:", teams.length);
      teams.forEach(t => console.log(JSON.stringify(t)));
      
      // Query 2: Games for 2026-09-23 involving team 141
      console.log("\n=== Query 2: Games on 2026-09-23 with team 141 ===");
      const games = await conn.query(
        `SELECT * FROM games WHERE official_date = '2026-09-23' AND (home_team_id = 141 OR away_team_id = 141) ORDER BY game_pk`
      );
      console.log("Games rows:", games.length);
      games.forEach(g => console.log(JSON.stringify(g)));
      
      // Query 3: Raw feed JSON for those game_pks
      if (games.length > 0) {
        const pks = games.map(g => g.game_pk);
        console.log("\n=== Query 3: Raw feeds for game_pks ===");
        const feeds = await conn.query(
          `SELECT game_pk, season, feed_ts, json FROM raw_game_feeds WHERE game_pk IN (${pks.join(',')}) ORDER BY game_pk`
        );
        console.log("Raw feed rows:", feeds.length);
        feeds.forEach(f => {
          console.log(`\ngame_pk ${f.game_pk}:`);
          if (f.json) {
            const j = JSON.parse(f.json);
            console.log("  feed_ts:", f.feed_ts);
            // Extract relevant team and game info from JSON
            if (j.gameData?.teams?.away?.team?.name) {
              console.log("  away_team_name:", j.gameData.teams.away.team.name);
            }
            if (j.gameData?.teams?.home?.team?.name) {
              console.log("  home_team_name:", j.gameData.teams.home.team.name);
            }
            if (j.gameData?.status?.abstractGameState) {
              console.log("  gameData.status.abstractGameState:", j.gameData.status.abstractGameState);
            }
          }
        });
      }
      
      // Query 4: Team ids in games but missing from teams
      console.log("\n=== Query 4: Team ids in games but not in teams ===");
      const orphanTeams = await conn.query(
        `SELECT DISTINCT t.team_id FROM (
          SELECT DISTINCT home_team_id as team_id FROM games
          UNION ALL
          SELECT DISTINCT away_team_id as team_id FROM games
        ) t LEFT JOIN teams ON t.team_id = teams.team_id
        WHERE teams.team_id IS NULL
        ORDER BY t.team_id`
      );
      if (orphanTeams.length > 0) {
        console.log("Team IDs in games but not in teams:");
        orphanTeams.forEach(r => console.log("  ", r.team_id));
      } else {
        console.log("None found");
      }
      
      // Query 5: Check if team 141 exists at all
      console.log("\n=== Query 5: Team 141 existence check ===");
      const tjTeam = await conn.query("SELECT * FROM teams WHERE team_id = 141");
      console.log("Team 141 rows:", tjTeam.length);
      if (tjTeam.length === 0) {
        console.log("** Team 141 (Toronto Blue Jays) is MISSING from teams table **");
      } else {
        tjTeam.forEach(t => console.log(JSON.stringify(t)));
      }
      
      // Query 6: How many teams total and check team 110
      console.log("\n=== Query 6: Team 110 check ===");
      const orioles = await conn.query("SELECT * FROM teams WHERE team_id = 110");
      console.log("Team 110 rows:", orioles.length);
      if (orioles.length > 0) {
        orioles.forEach(t => console.log(JSON.stringify(t)));
      }
      
    } finally {
      conn.closeSync();
    }
  } catch (err) {
    console.error("Error:", err.message);
    if (err.message.includes("MOTHERDUCK_TOKEN")) {
      console.error("Note: MOTHERDUCK_TOKEN env var may not be set");
    }
    process.exit(1);
  }
}

query();
