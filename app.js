const request = require('request');
const colors = require('colors');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', "utf-8"));

var pathOffsetFrom = config.database_configurations.file_db_setting.offsetfrom;
var offsetFrom = JSON.parse(fs.readFileSync(pathOffsetFrom, "utf-8"));

var accountName = config.basic_configurations.accountname;
var tokenSymbol = config.basic_configurations.token_symbol;
var historyLimit = config.basic_configurations.engine_api_limit;

var engineHistoryURL = "";

var selectSteemEngine =  config.basic_configurations.is_steem_engine;
var selectHiveEngine =  config.basic_configurations.is_hive_engine;

if(selectSteemEngine == true)
{	
	engineHistoryURL = config.basic_configurations.engine_api_account_history_steem;
}
if(selectHiveEngine == true)
{
	engineHistoryURL = config.basic_configurations.engine_api_account_history_hive;
}

var historyOffset = config.basic_configurations.engine_api_offset_start;
var historyOffsetContinue = config.basic_configurations.engine_api_offset_continue;
var operationInfo1 = config.basic_configurations.engine_api_operation_1;
var operationInfo2 = config.basic_configurations.engine_api_operation_2;

console.log('--------------------------------------------------------------------------------------'.yellow);
console.log('        -- '.green + accountName.yellow +' PROFIT & LOSS CHECKER OF '.green + tokenSymbol.yellow + ' TOKEN PROCESS STARTED --        '.green);
console.log('--------------------------------------------------------------------------------------'.yellow);
console.log('');

processEngineHistory();

function processEngineHistory()
{
	try
	{
		readEngineAccountHistory(accountName, tokenSymbol, historyLimit, historyOffset, historyOffsetContinue, function(res)
		{				
			if(res.length > 0)
			{
				var historyData = res;
				
				console.log('TOTAL TRANSACTIONS : '.yellow, historyData.length);
				
				calculateTrades(accountName, historyData, function(res)
				{
					var dataJson = res;
					
					if(dataJson.length > 0)
					{
						console.log(dataJson);
					}
					else
					{
						console.log(dataJson);
					}
				});
			}
		});
	}
	catch(error)
	{
		
	}
} 

function readEngineAccountHistory(accountName, tokenSymbol, historyLimit, historyOffset, historyOffsetContinue, callback)
{
	var i = 0;
	var offset;
	var historyJson = [];
	var maxAttempts = config.connection_configurations.reconnecting_attempts;
	maxAttempts = parseInt(maxAttempts) || 0;
	
	var attempIdleTime = config.connection_configurations.attempt_idle_time;
	attempIdleTime = parseInt(attempIdleTime) || 0;
	
	historyLimit = parseInt(historyLimit) || 0;
	historyOffset = parseInt(historyOffset) || 0;
	historyOffsetContinue = parseInt(historyOffsetContinue) || 0;
	
	readEngineAccountHistoryConnection();
	function readEngineAccountHistoryConnection()
	{
		try
		{
			historyPaging(historyOffset);
			function historyPaging(historyOffset)
			{
				try
				{
					var readHistoryURL = engineHistoryURL.replace('{{accountname}}', accountName).replace('{{tokensymbol}}', tokenSymbol).replace('{{historylimit}}', historyLimit).replace('{{historyoffset}}', historyOffset);
					
					console.log(readHistoryURL.yellow);
					
					let options = {json: true, rejectUnauthorized: false};		
					
					request(readHistoryURL, options, function(error, res, body)
					{					
						if(!error && res.statusCode == 200) 
						{	
							if(body.length > 0)
							{								
								body.forEach(function(tx)
								{									
									if(tx.operation == operationInfo1 || tx.operation == operationInfo2)
									{									
										var tokenQty = tx.quantityTokens;
										tokenQty = parseFloat(tokenQty) || 0.0; 
										tokenQty = tokenQty.toFixed(8);
										tokenQty = parseFloat(tokenQty);
										
										var steemQty = tx.quantitySteem;
										steemQty = parseFloat(steemQty) || 0.0; 
										steemQty = steemQty.toFixed(8);
										steemQty = parseFloat(steemQty)
										
										var timeStampISO = new Date(tx.timestamp * 1000).toISOString().substr(0, 19);

										var hiveReward = 0;	
										hiveReward = hiveReward.toFixed(3);
										
										var ddata =  {
											"blocknumber" : tx.blockNumber, 
											"transactionid" : tx.transactionId,
											"timestamp": tx.timestamp,
											"isotime": timeStampISO,
											"account" : tx.account,
											"operation" : tx.operation,
											"from" : tx.from,
											"to" : tx.to,
											"symbol" : tx.symbol,
											"quantityTokens" : tokenQty,
											"quantitySteem" : steemQty
										};
										
										historyJson.push(ddata);
									}																		
								});	
																
								historyOffset = historyOffset + historyOffsetContinue;
								offsetFrom.offset = historyOffset;
								writeOffsetFrom(offsetFrom, function(res)
								{
									if(res == true)
									{
										setTimeout (function() 
										{
											historyPaging(historyOffset);
										}, attempIdleTime);
									}
								});								
							}
							else
							{
								callback(historyJson);
							}							
						}
						else
						{
							console.log('Error At historyPaging() => request :'.red, error);
							setTimeout(function()
							{
								try
								{	if(i < maxAttempts)
									{
										console.log('RECONNECTING ATTEMPT : '.green, i);	
											
										var fromOffSetJson = JSON.parse(fs.readFileSync(pathOffsetFrom, "utf-8"));
										offset = fromOffSetJson.offset;
				
										historyPaging(offset);				
										
										i = i + 1;
									}
									else
									{
										callback(0);
									}
								}
								catch(error)
								{
									console.log('readEngineAccountHistoryConnection() ERROR :'.red, error);
									return;
								}
							}, attempIdleTime);
						}
					});
				}
				catch(error)
				{
					console.log('ERROR AT historyPaging() : '.red, error);
				}
			}			
		}
		catch(error)
		{
			console.log('ERROR AT readEngineAccountHistory() : '.red, error);
		}
	}
}

function writeOffsetFrom(offsetFrom, callback)
{
	try
	{
		fs.writeFile(pathOffsetFrom, JSON.stringify(offsetFrom, null, '\t'), function(err) 
		{
			if(!err)
			{
				callback(true);							
			}
			else
			{
				console.log('OFFSET JSON WRITE ERROR AT writeOffsetFrom() : '.red);
			}
		});
	}
	catch(error)
	{
		console.log('ERROR AT writeOffsetFrom() : '.red, error);
	}
}

function calculateTrades(accountName, historyData, callback)
{
	try
	{
		var calcBoughtTokens = 0.0;
		var calcExpensedSteem = 0.0;
		var calcSoldTokens = 0.0;
		var calcEarnedSteem = 0.0;
		var dataJson = [];
		
		historyData.forEach(function(tx)
		{
			if(tx.operation == operationInfo1)
			{
				calcBoughtTokens = parseFloat(calcBoughtTokens) + parseFloat(tx.quantityTokens) || 0.0;
				calcExpensedSteem = parseFloat(calcExpensedSteem) + parseFloat(tx.quantitySteem) || 0.0;
			}
			if(tx.operation == operationInfo2)
			{
				calcSoldTokens = parseFloat(calcSoldTokens) + parseFloat(tx.quantityTokens) || 0.0;
				calcEarnedSteem = parseFloat(calcEarnedSteem) + parseFloat(tx.quantitySteem) || 0.0;
			}				
		});		
		
		calcBoughtTokens = calcBoughtTokens.toFixed(8);
		calcBoughtTokens = parseFloat(calcBoughtTokens);
		
		calcExpensedSteem = calcExpensedSteem.toFixed(8);
		calcExpensedSteem = parseFloat(calcExpensedSteem);
		
		calcSoldTokens = calcSoldTokens.toFixed(8);
		calcSoldTokens = parseFloat(calcSoldTokens);
		
		calcEarnedSteem = calcEarnedSteem.toFixed(8);
		calcEarnedSteem = parseFloat(calcEarnedSteem);
		
		var profitLoss = calcEarnedSteem - calcExpensedSteem;		
		profitLoss = profitLoss.toFixed(8);
		profitLoss = parseFloat(profitLoss);	
		
		var ddata = {
			"account_name" : accountName,
			"bought_tokens" : calcBoughtTokens,
			"expensed_steem" : calcExpensedSteem,
			"sold_tokens" : calcSoldTokens,
			"earned_steem" : calcEarnedSteem,
			"profit_loss" : profitLoss
		}
		
		dataJson.push(ddata);		
		
		callback(dataJson);
	}
	catch(error)
	{
		console.log('ERROR AT calculateTrades() : '.red, error);
	}
}
