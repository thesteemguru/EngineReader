const hive = require('@hiveio/hive-js');
const steem = require('steem');
const mongo = require('mongodb');
const colors = require('colors');
const fs = require('fs');
const axios = require('axios');
const request = require('request');
const ssc = require('sscjs');
const config = JSON.parse(fs.readFileSync('./config.json', "utf-8"));

hive.api.setOptions({ url: config.api_configurations.hive_api_option });
hive.config.set('alternative_api_endpoints', [config.api_configurations.hive_alternative_api_endpoints_1, config.api_configurations.hive_alternative_api_endpoints_2]);

steem.api.setOptions({ url: config.api_configurations.steem_api_option });

var sscString = config.api_configurations.steem_engine_api_option_ssc;
var sscApi = new ssc(sscString);  

var pathOffsetFrom = config.database_configurations.file_db_setting.offsetfrom;
var offsetFrom = JSON.parse(fs.readFileSync(pathOffsetFrom, "utf-8"));

var pathTimeStamp = config.database_configurations.file_db_setting.timestamp;
var timeStampData = JSON.parse(fs.readFileSync(pathTimeStamp, "utf-8"));

const uri = config.database_configurations.database_uri;
const optiondb = config.database_configurations.database_options_setting.options;

var accountName = config.basic_configurations.accountname;
var tokenSymbol = config.token_reward_configurations.reward_setting.token_symbol;

function engineAccountHistory(callback)
{	
	tokenMarketHistory();	
}

function tokenMarketHistory()
{
	try
	{
		var contractName = config.token_market_configurations.market_setting.contract_name;
		var contractTable = config.token_market_configurations.market_setting.contract_table;
		
		var tokenMarketPrice = 0.0;
		
		console.log(contractName);
		console.log(contractTable);
		console.log(tokenSymbol);
		
		sscApi.findOne(contractName, contractTable,{symbol: tokenSymbol}, function(err, res)
		{
			if(!err)
			{
				console.log("RES : ", res);
			}
			else
			{
				console.log("ERR : ", err);
			}
		});
	}
	catch(error)
	{
		console.log("Error At tokenMarketHistory() : ", error);
	}
}

module.exports = {
	engineAccountHistory : engineAccountHistory
}