const SSC = require('sscjs');
const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const { api } = require('@hiveio/hive-js');
require('dotenv').config();

//connect to Webhook
const hook = new Webhook(process.env.DISCORD_WEBHOOK);


const url = process.env.MONGO_URL;
const dbName = 'terracore';
const SYMBOL = 'SCRAP';
const wif = process.env.ACTIVE_KEY;

var client = new MongoClient(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 7000 });

//find node to use
const nodes = ["https://herpc.dtools.dev", "https://engine.rishipanthee.com", "https://api.primersion.com", "https://api.hive-engine.com", "https://api2.hive-engine.com", "https://herpc.actifit.io", "https://api.primersion.com"];
var node;


async function findNode() {
    //try each node until one works, just try for a response
    for (let i = 0; i < nodes.length; i++) {
        try {
            const response = await fetch(nodes[i], {
                method: "GET",
                headers:{'Content-type' : 'application/json'},
            });
            const data = await response.json()
            node = nodes[i];
            break;
        } catch (error) {
            console.log("node " + nodes[i] + " not working");
        }
    }
}

async function webhook(title, message, color) {
    
    const embed = new MessageBuilder()
        .setTitle(title)
        .addField('Message: ', message, true)
        .setColor(color)
        .setTimestamp();
    try {
        hook.send(embed);
    }
    catch (err) {
        console.log(chalk.red("Discord Webhook Error"));
    }
    
}

async function engineBalance(username) {
    //make a list of nodes to try
    const nodes = ["https://engine.rishipanthee.com", "https://herpc.dtools.dev", "https://api.primersion.com"];
    var node;

    //try each node until one works, just try for a response
    for (let i = 0; i < nodes.length; i++) {
        try {
            const response = await fetch(nodes[i], {
                method: "GET",
                headers:{'Content-type' : 'application/json'},
            });
            const data = await response.json()
            node = nodes[i];
            break;
        } catch (error) {
            console.log(error);
        }
    }

                

    const response = await fetch(node + "/contracts", {
      method: "POST",
      headers:{'Content-type' : 'application/json'},
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "find",
        params: {
          contract: "tokens",
          table: "balances",
          query: {
            "account":username,
            "symbol":SYMBOL    
          }
        },
        "id": 1,
      })
    });
    const data = await response.json()
    if (data.result.length > 0) {
        return parseFloat(data.result[0].balance);
    } else {
        return 0;
    }
}

async function scrapStaked(username) {
    //make a list of nodes to try
    const nodes = ["https://engine.rishipanthee.com", "https://herpc.dtools.dev", "https://api.primersion.com"];
    var node;

    //try each node until one works, just try for a response
    for (let i = 0; i < nodes.length; i++) {
        try {
            const response = await fetch(nodes[i], {
                method: "GET",
                headers:{'Content-type' : 'application/json'},
            });
            const data = await response.json()
            node = nodes[i];
            break;
        } catch (error) {
            console.log(error);
        }
    }

                

    const response = await fetch(node + "/contracts", {
      method: "POST",
      headers:{'Content-type' : 'application/json'},
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "find",
        params: {
          contract: "tokens",
          table: "balances",
          query: {
            "account":username,
            "symbol":SYMBOL    
          }
        },
        "id": 1,
      })
    });
    const data = await response.json()
    if (data.result.length > 0) {
        return parseFloat(data.result[0].stake);
    } else {
        return 0;
    }
}

async function storeHash(hash, username) {
    let db = client.db(dbName);
    let collection = db.collection('hashes');
    let result = await collection.insertOne({hash: hash, username: username, time: Date.now()});
    console.log('Hash ' + hash + ' stored');
}
//defense upgrade
async function defense(username, quantity) {
    let db = client.db(dbName);
    let collection = db.collection('players');

    //create loop to run until update is successful
    let user = await collection.findOne({ username : username });
    if (!user) {
        return;
    }
    while (true) {
        let cost = Math.pow(user.defense/10, 2);
        if (quantity == cost){
            await collection.updateOne({username : username}, {$inc: {defense: 10}});
            webhook('Upgrade', username + ' upgraded defense to ' + (user.defense + 10), '#86fc86');
        }
        else {
            return;
        }

        //check if update was successful
        let userCheck = await collection.findOne({ username : username });
        if (userCheck.defense == user.defense + 10) {
            break;
        }
     
    }
}
//engineering upgrade
async function engineering(username, quantity) {
    let db = client.db(dbName);
    let collection = db.collection('players');

    //create loop to run until update is successful
    let user = await collection.findOne({ username : username });
    if (!user) {
        return;
    }
    while (true) {
        let cost = Math.pow(user.engineering, 2);
        //new minerate is old minerate + 10% of old minerate
        var newrate = user.minerate + (user.minerate * 0.1);

        if (quantity == cost){
            //update user   
            await collection.updateOne({username: username}, {$inc: {engineering: 1}});
            await collection.updateOne({username: username }, {$set: {minerate: newrate}});
            webhook('Engineering Upgrade', username + ' has upgraded their engineering to ' + (user.engineering + 1), '#86fc86')
        }
        else {
            break;
        }

        //check if update was successful
        let userCheck = await collection.findOne({ username : username });
        if (userCheck.engineering == user.engineering + 1 && userCheck.minerate == newrate) {
            break;
        }
    }

}

//damage upgrade
async function damage(username, quantity) {
    let db = client.db(dbName);
    let collection = db.collection('players');
    let user = await collection.findOne({ username : username });

    //check if user exists
    if (!user) {
        return;
    }
    while (true) {
        let cost = Math.pow(user.damage/10, 2);

        if (quantity == cost){
            await collection.updateOne({username: username}, {$inc: {damage: 10}});
            webhook('Damage Upgrade', username + ' has upgraded their damage to ' + (user.damage + 10), '#86fc86');
        }
        else {
            break;
        }

        //check if update was successful
        let userCheck = await collection.findOne({ username : username });
        if (userCheck.damage == user.damage + 10) {
            break;
        }
    }

}


//function to check if tx is complete
async function checkTx(txId) {
    //try to see if tx is complete catch orders and try at least 3 times
    var apis = ["https://api.hive-engine.com/rpc/blockchain", "https://api2.hive-engine.com/rpc/blockchain", "https://engine.rishipanthee.com/rpc/blockchain", "https://herpc.dtools.dev/rpc/blockchain", "https://api.primersion.com/rpc/blockchain", "https://herpc.actifit.io/rpc/blockchain"];

    for (let i = 0; i < apis.length; i++) {
        const response = await fetch(apis[i], {
            method: "POST",
            headers:{'Content-type' : 'application/json'},
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "getTransactionInfo",
                params: {
                    txid: txId
                },
                "id": 1,
            })
        });
        const data = await response.json()
        console.log(data);
        //parse json from logs: '{"errors":["overdrawn balance"]}'
        var logs = JSON.parse(data.result.logs);
        //check if errors exist
        if (logs.errors) {
            console.log('error found');
            return false;
        }
        else if  (data.result) {
            return true;
        } 
        else {
            //return false;
            //do nothing
        }
    }

    return false;
}

//contributor upgrade
async function contribute(username, quantity) {
    let db = client.db(dbName);
    let collection = db.collection('players');
    let user = await collection.findOne({username: username});

    //check if user exists
    if (!user) {
        return;
    }
    //check starting favor
    let startFavor = user.favor;

    while (true) {
        var qty = parseFloat(quantity);
        //add quantity to favor
        await collection.updateOne({username: username}, {$inc: {favor: qty}});
        //load stats collection
        var stats = db.collection('stats');
        await stats.updateOne({date: "global"}, {$inc: {currentFavor: qty}});
        
        //check if update was successful
        collection = db.collection('players');
        //check if new favor is correct
        var userCheck = await collection.findOne({ username : username });
        if (userCheck.favor == startFavor + qty) {
            webhook("New Contribution", "User " + username + " contributed " + qty.toString() + " favor", '#c94ce6')
            break;
        }
        else{
            break;
        }
    }


}

var lastevent = Date.now();
//aysncfunction to start listening for events
async function listen() {
    await findNode();
    const ssc = new SSC(node);
    ssc.stream((err, res) => {
        lastevent = Date.now();

        //loop through transactions and look for events
        try{
            for (var i = 0; i < res['transactions'].length; i++) {
                //check if contract is token
                if (res['transactions'][i]['contract'] == 'tokens' && res['transactions'][i]['action'] == 'transfer') {
                    //console.log(res['transactions'][i]);
                    //convert payload to json
                    var payload = JSON.parse(res['transactions'][i]['payload']);

                    //check if to is "terracore"
                    if (payload.to == 'terracore' && payload.symbol == 'SCRAP') {
                        //get memo 
                        var memo = {
                            event: payload.memo.split('-')[0],
                            hash: payload.memo.split('-')[1],
                        }
                        var from = res['transactions'][i]['sender'];
                        var quantity = payload.quantity;
                        var tx = res['transactions'][i]
                        console.log(res['transactions'][i]);

                    
                        var isComplete = checkTx(res['transactions'][i].transactionId);
                        //wait for promise from isComplete then log
                        isComplete.then(function(result) {
                            //console.log(result);
                            if (!result) {
                                //no action
                                return
                            }     
                            else{                          
                                //check if memo is engineering
                                if (memo.event == 'terracore_engineering'){
                                    engineering(from, quantity);
                                    setTimeout(function(){engineering(from, quantity)}, 5000);
                                    return;
                                }
                                else if (memo.event == 'terracore_health'){
                                    health(from, quantity);
                                    setTimeout(function(){health(from, quantity)}, 5000);
                                    return;
                
                                }
                                else if (memo.event == 'terracore_damage'){
                                    damage(from, quantity);
                                    setTimeout(function(){damage(from, quantity)}, 5000);
                                    return;
                                }
                                else if (memo.event == 'terracore_defense'){
                                    defense(from, quantity);
                                    setTimeout(function(){defense(from, quantity)}, 5000);
                                    return;
                                }
                                else if (memo.event == 'terracore_contribute'){
                                    contribute(from, quantity);
                                    //setTimeout(function(){contribute(from, quantity)}, 5000);
                                    return;
                                }
                                else{
                                    console.log('Unknown event');
                                    return;
                                }
                            }                    
                        });
                        
                    }

                }
                else if (res['transactions'][i]['contract'] == 'tokens' && res['transactions'][i]['action'] == 'stake') {
                    //convert payload to json
                    var payload = JSON.parse(res['transactions'][i]['payload']);

                    //check if symbol is scrap
                    if (payload.symbol == 'SCRAP') {
                        var sender = res['transactions'][i]['sender'];
                        var qty = payload.quantity;
                        var isComplete = checkTx(res['transactions'][i].transactionId);
                        isComplete.then(function(result) {
                            console.log(result);
                            if (!result) {
                                //no action
                                return
                            }     
                            else{
                                webhook('New Stake', sender + ' has staked ' + qty + ' ' + "SCRAP", '#FFA500');
                            }                    
                        });

                      
                    }


                }
            }
        }
        catch(err){
            console.log(err);
        }




    });
}






//testwebhook
//track last event and reset claims every 15 seconds
listen();
lastevent = Date.now();
//kill process if no events have been received in 30 seconds
setInterval(function() {
    console.log('Last event: ' + (Date.now() - lastevent) + ' ms ago');
    if (Date.now() - lastevent > 30000) {
        console.log('No events received in 30 seconds, shutting down so pm2 can restart');
        process.exit();
    }
}, 1000);






