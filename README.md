# EngineReader
By using EngineReader, you can check your Profit & loss Statement on any token project that you invested money at Hive-Engine or Steem-Engine.

Goto config.json & do below changes
01. "accountname" : "<<your hive/steem username>>",
02. "token_symbol" : "<<TOKEN Symbol you invested>>",
03. If STEEM-ENGINE set => "is_steem_engine" : true, (Set "is_hive_engine" : false)
04. If HIVE-ENGINE set => "is_hive_engine" : true, ((Set "is_steem_engine" : false)

Then excute the script by
01. npm install --save
02. node app.js
