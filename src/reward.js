const hive = require('@hiveio/hive-js');
const steem = require('steem');
const mongo = require('mongodb');
const colors = require('colors');
const wait = require('wait.for');
const fs = require('fs');
const axios = require('axios');
const request = require('request');
const config = JSON.parse(fs.readFileSync('./config.json', "utf-8"));

hive.api.setOptions({ url: config.api_configurations.hive_api_option });
hive.config.set('alternative_api_endpoints', [config.api_configurations.hive_alternative_api_endpoints_1, config.api_configurations.hive_alternative_api_endpoints_2]);

steem.api.setOptions({ url: config.api_configurations.steem_api_option });

const uri = config.database_configurations.database_uri;
const optiondb = config.database_configurations.database_options_setting.options;

var accountName = config.basic_configurations.accountname;

var swapData = [];
var countSwaps = 0;

function processLatestSwapTrans()
{
	try
	{		
		getLatestSwapTrans(function(res)
		{
			if(res.length > 0)
			{
				swapData = res;
				swapData.sort(function(a, b) 
				{
					return parseFloat(b.timestamp) - parseFloat(a.timestamp);
				});
				
				getSwapInfo(swapData, accountName, function(res)
				{
					if(res == true)
					{						
						console.log('SWAP TRANSCATIONS SUCCESSFULLY PROCCESSED'.green);
					}
					else
					{
						console.log('REWARD DISTRIBUTION OF SWAP TRANSACTIONS NOT PROCCESSED'.red);
					}
				});				
			}
			else
			{
				console.log('NO LATEST SWAP TRANSACTIONS TO PROCCESSED'.red);
			}
		});		
	}
	catch(error)
	{
		console.log('ERROR AT processLatestSwapTrans() : '.red);
	}
}

function getLatestSwapTrans(callback)
{
	try
	{
		getLatestSwapTransConnection();
		function getLatestSwapTransConnection()
		{
			try
			{
				var latestSwap = [];	
				mongo.connect(uri, optiondb, function(err, client)
				{
					if(!err) 
					{
						var dbo = client.db(config.database_configurations.database_name);	
						var collectionSwapTb = dbo.collection(config.database_configurations.database_tables_1);		
						
						collectionSwapTb.find({reward:false, refund:false, burn:false}).toArray((err, results) => 
						{
							if(!err) 
							{
								if(results.length > 0)
								{
									
									latestSwap = results;
									callback(latestSwap);	
								}
								else
								{
									callback(latestSwap);
								}
							}
						});							
					}
					else
					{
						setTimeout(function()
						{
							try
							{
								client.close();		
								getLatestSwapTransConnection();
							}
							catch(error)
							{
								console.log('getLatestSwapTransConnection() MONGO CONNECTION ERROR : '.red);
								return;
							}
						}, 1000);
					}						
				});			
			}	
			catch(error)
			{
				console.log('ERROR AT getLatestSwapTransConnection() : '.red);
			}
		}
	}
	catch(error)
	{
		console.log('ERROR AT getLatestSwapTrans() : '.red);
	}
}

function getSwapInfo(swapData, accountName, callback)
{
	try
	{
		countSwaps = swapData.length;
		countSwaps = parseInt(countSwaps) || 0;
		
		var attempIdleTime = config.connection_configurations.attempt_idle_time;
		attempIdleTime = parseInt(attempIdleTime) || 0;
		
		getSwapCount(countSwaps);
		function getSwapCount(countSwaps)
		{
			try
			{				
				var hiveBalance = 0.0;
				var hiveAmount = 0.0;
				var swapAmount = 0.0;
				var swapRatio = config.token_reward_configurations.token_ratio;
				swapRatio = swapRatio.toFixed(8);
				swapRatio = parseFloat(swapRatio) || 0.0;
				var setCurrency = config.api_configurations.enabled_api_option;
				var getTime = swapData[countSwaps - 1].timestamp;				
				
				wait.launchFiber(function() 
				{					
					swapAmount = swapData[countSwaps - 1].quantity;
					swapAmount = parseFloat(swapAmount) || 0.0;
					swapAmount = swapAmount.toFixed(8);				
						
					hiveAmount = swapAmount * swapRatio;
					hiveAmount = hiveAmount.toFixed(3);
					hiveAmount = parseFloat(hiveAmount) || 0.0;	
						
					var accountData = wait.for(hive.api.getAccounts,[accountName]);
					hiveBalance = accountData[0].balance.replace(setCurrency, "");
					hiveBalance = parseFloat(hiveBalance) || 0.0;
						
					if(hiveBalance > hiveAmount && hiveAmount > 0.0)
					{
						var swapUser = swapData[countSwaps - 1];
						
						swapHiveRewardStatus(swapUser, hiveAmount, function(res)
						{
							if(res == true)
							{
								countSwaps = countSwaps - 1;
								
								setTimeout (function() 
								{
									if(countSwaps > 0)
									{
										getSwapCount(countSwaps);
									}
									else
									{
										callback(true);
									}
								}, attempIdleTime);
								console.log('SWAP LENGTH COUNT : '.yellow, countSwaps);
							}
							else
							{
								countSwaps = countSwaps - 1;
								
								setTimeout (function() 
								{
									if(countSwaps > 0)
									{
										getSwapCount(countSwaps);
									}
									else
									{
										callback(false);
									}
								}, attempIdleTime);
								console.log('SWAP LENGTH COUNT : '.yellow, countSwaps);
							}
						});						
					}
					else
					{
						var swapUser = swapData[countSwaps - 1];
						
						checkTokenBalance(function(res)
						{
							var totalTokenBalance = res;
							totalTokenBalance = parseFloat(totalTokenBalance) || 0.0;
							
							var swapTokenBalance = swapUser.quantity;
							swapTokenBalance = parseFloat(swapTokenBalance) || 0.0;

							if(totalTokenBalance >= swapTokenBalance)
							{								
								swapTokenRewardStatus(swapUser, function(res)
								{
									if(res == true)
									{
										countSwaps = countSwaps - 1;
										
										setTimeout (function() 
										{
											if(countSwaps > 0)
											{
												getSwapCount(countSwaps);
											}
											else
											{
												callback(true);
											}
										}, attempIdleTime);
										console.log('SWAP LENGTH COUNT : '.yellow, countSwaps);
									}
									else
									{
										countSwaps = countSwaps - 1;
										
										setTimeout (function() 
										{
											if(countSwaps > 0)
											{
												getSwapCount(countSwaps);
											}
											else
											{
												callback(false);
											}
										}, attempIdleTime);
										console.log('SWAP LENGTH COUNT : '.yellow, countSwaps);
									}
								});
							}
							else
							{
								console.log('TOKEN BALANCE IS NOT ENOUGH'.blue);
								countSwaps = countSwaps - 1;
										
								setTimeout (function() 
								{
									if(countSwaps > 0)
									{
										getSwapCount(countSwaps);
									}
									else
									{
										callback(false);
									}
								}, attempIdleTime);
								console.log('SWAP LENGTH COUNT : '.yellow, countSwaps);
							}
						});
					}											
				});
			}
			catch(error)
			{
				console.log('ERROR AT getSwapInfo() : '.red, error);
			}
		}
	}
	catch(error)
	{
		console.log('ERROR AT getSwap() : '.red, error);
	}
}

function swapHiveRewardStatus(swapUser, hiveAmount, callback)
{
	try
	{
		sendHiveRewards(swapUser, hiveAmount, function(res)
		{
			if(res == true)
			{
				console.log('REWARD SENT SUCCESSFULLY'.yellow);
				var rewardSent = true;
				var refundSent = false;
				
				checkTokenBalanceForHiveRewards(function(res)
				{
					var totalTokenBalance = res;
					totalTokenBalance = parseFloat(totalTokenBalance) || 0.0;
							
					var swapTokenBalance = swapUser.quantity;
					swapTokenBalance = parseFloat(swapTokenBalance) || 0.0;
					
					if(totalTokenBalance >= swapTokenBalance)
					{
						burnSwappedTokens(swapUser, function(res)
						{
							if(res == true)
							{
								console.log('SWAPPED TOKENS BURNED SUCCESSFULLY'.red);
								var burnSent = true;
								updateHiveRewards(swapUser, hiveAmount, rewardSent, refundSent, burnSent, function(res)
								{
									if(res == true)
									{
										callback(true);
									}
								});
							}
							else
							{
								var burnSent = false;
								updateHiveRewards(swapUser, hiveAmount, rewardSent, refundSent, burnSent, function(res)
								{
									if(res == true)
									{
										callback(true);
									}
								});
							}
						});
					}
					else
					{
						var burnSent = false;
						updateHiveRewards(swapUser, hiveAmount, rewardSent, refundSent, burnSent, function(res)
						{
							if(res == true)
							{
								callback(true);
							}
						});	
					}					
				});
			}
			else
			{
				console.log('REWARD NOT SENT'.red);
				callback(false);
			}				
		});
	}
	catch(error)
	{
		console.log('ERROR AT swapRewardStatus() : '.red, error);
	}
}

function sendHiveRewards(swapUser, hiveAmount, callback)
{
	var activeKey = config.basic_configurations.keys.active;
	var accountFrom = config.basic_configurations.username;
	var tokenSymbol = config.token_reward_configurations.reward_setting.token_symbol;
	var coinSymbol = config.api_configurations.enabled_api_option;
	var accountTo = swapUser.from;
	var sendAmount = hiveAmount;
	sendAmount = parseFloat(sendAmount) || 0.0;	
	sendAmount = sendAmount.toFixed(3);
	sendAmount = sendAmount + ' ' + coinSymbol;
	
	var swapRatioCalc = config.token_reward_configurations.token_ratio;
	swapRatioCalc = parseFloat(swapRatioCalc) || 0.0;
	var setSwapRatio = 1 / swapRatioCalc;
	var swapRatio = '1:' + setSwapRatio.toString();
	
	var currentDate = new Date().toISOString(undefined, 
	{
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).substr(0, 19);
		
	var date = currentDate.substr(0,10);
		
	var time = currentDate.substr(11,19);
	
	var memoTextTemp = config.token_reward_configurations.reward_setting.memo.coin_reward_memo;
	var memoText = memoTextTemp.replace('{{symbol}}', tokenSymbol).replace('{{coinsymbol}}', coinSymbol).replace('{{ratio}}', swapRatio).replace('{{date}}', date).replace('{{time}}', time);
	
	var i = 0;
	var maxAttempts = config.connection_configurations.reconnecting_attempts;
	maxAttempts = parseInt(maxAttempts) || 0;
	
	var attempIdleTime = config.connection_configurations.attempt_idle_time;
	attempIdleTime = parseInt(attempIdleTime) || 0;
	
	sendHiveRewardsConnection();
	function sendHiveRewardsConnection()
	{	
		try
		{		
			hive.broadcast.transfer(activeKey, accountFrom, accountTo, sendAmount, memoText, function(err, result) 
			{
				if(!err)
				{
					console.log('SWAPPED '.green + coinSymbol.yellow + ' AMOUNT : '.green, sendAmount.yellow);
					callback(true);
				}
				else
				{
					console.log('ERROR AT sendHiveRewardsConnection() => hive.broadcast.transfer '.red, err);
					setTimeout(function()
					{
						try
						{	if(i < maxAttempts)
							{
								console.log('RECONNECTING ATTEMPT : '.green, i);	
								sendHiveRewardsConnection();								
								i = i + 1;
							}
							else
							{
								callback(false);
							}
						}
						catch(error)
						{
							console.log('sendHiveRewardsConnection() ERROR :'.red, error);
							return;
						}
					}, attempIdleTime);
				}
			});		
		}
		catch(error)
		{
			console.log('ERROR AT sendHiveRewards() : '.red, error);
		}
	}
}

function checkTokenBalanceForHiveRewards(callback) 
{
	var i = 0;
	var maxAttempts = config.connection_configurations.reconnecting_attempts;
	maxAttempts = parseInt(maxAttempts) || 0;
	
	var attempIdleTime = config.connection_configurations.attempt_idle_time;
	attempIdleTime = parseInt(attempIdleTime) || 0;
	
	var accountName = config.basic_configurations.username;
	var tokenSymbol = config.token_reward_configurations.reward_setting.token_symbol;
	
	var requestURL = config.api_configurations.hive_engine_api_option_axios;
	var tokenBalance = 0.0;
	
	checkTokenBalanceForHiveRewardsConnection();
	function checkTokenBalanceForHiveRewardsConnection()
	{
		try
		{
			var request = {
				id: 1,
				jsonrpc: "2.0",
				method: "find",
				params: {
					contract: "tokens",
					indexes: "",
					limit: 1000,
					offset: 0,
					query: {account: accountName},
					account: accountName,
					table: "balances"
				}
			}
			axios.post(requestURL, request).then((res) => {
				var tokens = res.data.result;
				for(var i = 0; i <= tokens.length - 1; i++) 
				{
					if(tokens[i].symbol == tokenSymbol) 
					{
						tokenBalance = parseFloat(tokens[i].balance) || 0.0;
						tokenBalance = tokenBalance.toFixed(8);
						callback(tokenBalance);
						return;						
					}
				}
				callback(tokenBalance);
			})
			.catch((error) => {
				console.log('Error At checkTokenBalanceForHiveRewardsConnection() => axios.post :'.red);
				setTimeout(function()
				{
					try
					{	if(i < maxAttempts)
						{
							console.log('RECONNECTING ATTEMPT : '.green, i);	
							checkTokenBalanceForHiveRewardsConnection();								
							i = i + 1;
						}
						else
						{
							callback(tokenBalance);
							return;
						}
					}
					catch(error)
					{
						console.log('checkTokenBalanceForHiveRewardsConnection() ERROR :'.red, error);
						callback(tokenBalance);
						return;
					}
				}, attempIdleTime);
			});
		}
		catch(error)
		{
			console.log('ERROR AT checkTokenBalanceForHiveRewards() : '.red, error);
		}
	}
}

function burnSwappedTokens(swapUser, callback)
{
	var contractName = config.token_burning_configurations.burning_setting.contract_name;
	var contractAction = config.token_burning_configurations.burning_setting.contract_type;
	var customJsonId = config.api_configurations.custom_json_id; 
	
	var activeKey = config.basic_configurations.keys.active;
	var accountFrom = config.basic_configurations.username;
	var tokenSymbol = config.token_burning_configurations.burning_setting.token_symbol;
	var accountTo = config.token_burning_configurations.burning_setting.burner_account;
	var swapAmount = swapUser.quantity;
	swapAmount = parseFloat(swapAmount) || 0.0;	
	swapAmount = swapAmount.toFixed(8);
	
	var currentDate = new Date().toISOString(undefined, 
	{
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).substr(0, 19);
		
	var date = currentDate.substr(0,10);
		
	var time = currentDate.substr(11,19);
	
	var memoTextTemp = config.token_burning_configurations.burning_setting.memo.token_burning_memo;
	var memoText = memoTextTemp.replace('{{symbol}}', tokenSymbol).replace('{{date}}', date).replace('{{time}}', time);
	memoText = memoText.toString();
	
	var burnerJson = 
	{
		"contractName": contractName,
		"contractAction": contractAction,
		"contractPayload": {
			"symbol": tokenSymbol,
			"to": accountTo,
			"quantity": swapAmount,
			"memo": memoText
		}
	}
	
	var i = 0;
	var maxAttempts = config.connection_configurations.reconnecting_attempts;
	maxAttempts = parseInt(maxAttempts) || 0;
	
	var attempIdleTime = config.connection_configurations.attempt_idle_time;
	attempIdleTime = parseInt(attempIdleTime) || 0;	
	
	burnSwappedTokensConnection();
	function burnSwappedTokensConnection()
	{	
		try
		{		
			hive.broadcast.customJson(activeKey, [accountFrom], [], customJsonId, JSON.stringify(burnerJson), function(err, result)
			{
				if(!err)
				{
					callback(true);
				}
				else
				{
					console.log('ERROR AT burnSwappedTokensConnection() => hive.broadcast.customJson '.red, err);
					setTimeout(function()
					{
						try
						{	if(i < maxAttempts)
							{
								console.log('RECONNECTING ATTEMPT : '.green, i);	
								burnSwappedTokensConnection();								
								i = i + 1;
							}
							else
							{
								callback(false);
							}
						}
						catch(error)
						{
							console.log('burnSwappedTokensConnection() ERROR :'.red, error);
							return;
						}
					}, attempIdleTime);
				}
			});		
		}
		catch(error)
		{
			console.log('ERROR AT burnSwappedTokens() : '.red, error);
		}
	}
}

function updateHiveRewards(swapUser, hiveAmount, rewardSent, refundSent, burnSent, callback)
{
	updateHiveRewardsConnection();
	function updateHiveRewardsConnection()
	{		
		try
		{
			mongo.connect(uri, optiondb, (err, client) => 
			{
				if(!err) 
				{
					var dbo = client.db(config.database_configurations.database_name);	
					var collectionSwapTb = dbo.collection(config.database_configurations.database_tables_1);
					
					var timeStamp = swapUser.timestamp;
					var accountTo = swapUser.from;
					var blockNumber = swapUser.blocknumber;
					var transactionId = swapUser.transactionid;
					
					var rewardStatus = rewardSent;
					var refundStatus = refundSent;
					var burnStatus = burnSent;
					var hiveStatus = hiveAmount;
					hiveStatus = hiveStatus.toFixed(3);
					hiveStatus = parseFloat(hiveStatus) || 0.0;
					
					collectionSwapTb.updateOne({from: accountTo, timestamp: timeStamp, blocknumber: blockNumber, transactionid: transactionId }, {'$set': {'reward': rewardStatus, 'refund': refundStatus, 'burn': burnStatus, 'hive': hiveStatus}}, (err, results) => 
					{
						if(!err) 
						{
							console.log('SWAP REWARD COLLECTION UPDATED'.yellow);	
						}
						else
						{
							console.log('ERROR AT updateHiveRewardsConnection() mongo.connect :', err);
						}
						client.close();
					});
					callback(true);					
				}	
				else
				{
					setTimeout(function()
					{
						try
						{
							client.close();
							updateHiveRewardsConnection();
						}
						catch(error)
						{
							console.log('updateHiveRewardsConnection() MONGO CONNECTION ERROR :', error);
							return;
						}
					}, 1000);
				}	
			});		
		}
		catch(error)
		{
			console.log('ERROR AT updateHiveRewards() : '.red, error);
		}
	}
}

function swapTokenRewardStatus(swapUser, callback)
{
	try
	{
		refundTokenRewards(swapUser, function(res)
		{
			if(res == true)
			{
				console.log('TOKEN REFUND SENT SUCCESSFULLY'.yellow);
				
				updateRefundTokenRewards(swapUser, function(res)
				{
					if(res == true)
					{
						callback(true);
					}
				});
			}
			else
			{
				console.log('REFUND NOT SENT SUCCESSFULLY'.red);
				callback(false);
			}			
		});
	}
	catch(error)
	{
		console.log('ERROR AT swapTokenRewardStatus() : '.red, error);
	}
}

function checkTokenBalance(callback) 
{
	var i = 0;
	var maxAttempts = config.connection_configurations.reconnecting_attempts;
	maxAttempts = parseInt(maxAttempts) || 0;
	
	var attempIdleTime = config.connection_configurations.attempt_idle_time;
	attempIdleTime = parseInt(attempIdleTime) || 0;
	
	var accountName = config.basic_configurations.username;
	var tokenSymbol = config.token_reward_configurations.reward_setting.token_symbol;
	
	var requestURL = config.api_configurations.hive_engine_api_option_axios;
	var tokenBalance = 0.0;
	
	checkTokenBalanceConnection();
	function checkTokenBalanceConnection()
	{
		try
		{
			var request = {
				id: 1,
				jsonrpc: "2.0",
				method: "find",
				params: {
					contract: "tokens",
					indexes: "",
					limit: 1000,
					offset: 0,
					query: {account: accountName},
					account: accountName,
					table: "balances"
				}
			}
			axios.post(requestURL, request).then((res) => {
				var tokens = res.data.result;
				for(var i = 0; i <= tokens.length - 1; i++) 
				{
					if(tokens[i].symbol == tokenSymbol) 
					{
						tokenBalance = parseFloat(tokens[i].balance) || 0.0;
						tokenBalance = tokenBalance.toFixed(8);
						callback(tokenBalance);
						return;						
					}
				}
				callback(tokenBalance);
			})
			.catch((error) => {
				console.log('Error At checkTokenBalanceConnection() => axios.post :'.red);
				setTimeout(function()
				{
					try
					{	if(i < maxAttempts)
						{
							console.log('RECONNECTING ATTEMPT : '.green, i);	
							checkTokenBalanceConnection();								
							i = i + 1;
						}
						else
						{
							callback(tokenBalance);
							return;
						}
					}
					catch(error)
					{
						console.log('checkTokenBalanceConnection() ERROR :'.red, error);
						callback(tokenBalance);
						return;
					}
				}, attempIdleTime);
			});
		}
		catch(error)
		{
			console.log('ERROR AT checkTokenBalance() : '.red, error);
		}
	}
}

function refundTokenRewards(swapUser, callback)
{
	var contractName = config.token_reward_configurations.reward_setting.contract_name;
	var contractAction = config.token_reward_configurations.reward_setting.contract_type;
	var customJsonId = config.api_configurations.custom_json_id; 
	
	var activeKey = config.basic_configurations.keys.active;
	var accountFrom = config.basic_configurations.username;
	var tokenSymbol = config.token_reward_configurations.reward_setting.token_symbol;
	var coinSymbol = config.api_configurations.enabled_api_option;
	var accountTo = swapUser.from;
	var swapAmount = swapUser.quantity;
	swapAmount = parseFloat(swapAmount) || 0.0;	
	swapAmount = swapAmount.toFixed(8);
	
	var swapRatioCalc = config.token_reward_configurations.token_ratio;
	swapRatioCalc = parseFloat(swapRatioCalc) || 0.0;
	var setSwapRatio = 1 / swapRatioCalc;
	var swapRatio = '1:' + setSwapRatio.toString();
	
	var currentDate = new Date().toISOString(undefined, 
	{
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).substr(0, 19);
		
	var date = currentDate.substr(0,10);
		
	var time = currentDate.substr(11,19);
	
	var memoTextTemp = config.token_reward_configurations.reward_setting.memo.token_reward_memo;
	var memoText = memoTextTemp.replace('{{symbol}}', tokenSymbol).replace('{{coinsymbol}}', coinSymbol).replace('{{ratio}}', swapRatio).replace('{{date}}', date).replace('{{time}}', time);
	memoText = memoText.toString();
	
	var refundJson = 
	{
		"contractName": contractName,
		"contractAction": contractAction,
		"contractPayload": {
			"symbol": tokenSymbol,
			"to": accountTo,
			"quantity": swapAmount,
			"memo": memoText
		}
	}
	
	var i = 0;
	var maxAttempts = config.connection_configurations.reconnecting_attempts;
	maxAttempts = parseInt(maxAttempts) || 0;
	
	var attempIdleTime = config.connection_configurations.attempt_idle_time;
	attempIdleTime = parseInt(attempIdleTime) || 0;	
	
	refundTokenRewardsConnection();
	function refundTokenRewardsConnection()
	{	
		try
		{		
			hive.broadcast.customJson(activeKey, [accountFrom], [], customJsonId, JSON.stringify(refundJson), function(err, result)
			{
				if(!err)
				{					
					callback(true);
				}
				else
				{
					console.log('ERROR AT refundTokenRewardsConnection() => hive.broadcast.customJson '.red, err);
					setTimeout(function()
					{
						try
						{	if(i < maxAttempts)
							{
								console.log('RECONNECTING ATTEMPT : '.green, i);	
								refundTokenRewardsConnection();								
								i = i + 1;
							}
							else
							{
								callback(false);
							}
						}
						catch(error)
						{
							console.log('refundTokenRewardsConnection() ERROR :'.red, error);
							return;
						}
					}, attempIdleTime);
				}
			});		
		}
		catch(error)
		{
			console.log('ERROR AT refundTokenRewards() : '.red, error);
		}
	}
}

function updateRefundTokenRewards(swapUser, callback)
{
	updateRefundTokenRewardsConnection();
	function updateRefundTokenRewardsConnection()
	{		
		try
		{
			mongo.connect(uri, optiondb, (err, client) => 
			{
				if(!err) 
				{
					var dbo = client.db(config.database_configurations.database_name);	
					var collectionSwapTb = dbo.collection(config.database_configurations.database_tables_1);
					
					var timeStamp = swapUser.timestamp;
					var accountTo = swapUser.from;
					var blockNumber = swapUser.blocknumber;
					var transactionId = swapUser.transactionid;
					
					var refundStatus = true;					
					
					collectionSwapTb.updateOne({from: accountTo, timestamp: timeStamp, blocknumber: blockNumber, transactionid: transactionId }, {'$set': {'refund': refundStatus}}, (err, results) => 
					{
						if(!err) 
						{
							console.log('TOKEN REFUND DATABASE UPDATED SUCCESSFULLY'.yellow);	
						}
						else
						{
							console.log('ERROR AT updateRefundTokenRewardsConnection() mongo.connect :', err);
						}
						client.close();
					});
					callback(true);					
				}	
				else
				{
					setTimeout(function()
					{
						try
						{
							client.close();
							updateRefundTokenRewardsConnection();
						}
						catch(error)
						{
							console.log('updateRefundTokenRewardsConnection() MONGO CONNECTION ERROR :', error);
							return;
						}
					}, 1000);
				}	
			});		
		}
		catch(error)
		{
			console.log('ERROR AT updateRefundTokenRewards() : '.red, error);
		}
	}
}

module.exports = {
	processLatestSwapTrans : processLatestSwapTrans
}