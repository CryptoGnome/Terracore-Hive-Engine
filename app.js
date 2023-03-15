const SSC = require('sscjs');
const { MongoClient, MongoTopologyClosedError } = require('mongodb');
const fetch = require('node-fetch');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const { api } = require('@hiveio/hive-js');
const e = require('express');
require('dotenv').config();

//connect to Webhook
const hook = new Webhook(process.env.DISCORD_WEBHOOK);



const dbName = 'terracore';
var client = new MongoClient(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 7000 });


//find node to use
const nodes = ["https://herpc.dtools.dev", "https://engine.rishipanthee.com", "https://api.primersion.com", "https://api.hive-engine.com", "https://api2.hive-engine.com", "https://herpc.actifit.io", "https://api.primersion.com"];
var node;


async function findNode() {
    //try each node until one works, just try for a response
    for (let i = 0; i < nodes.length; i++) {
        try {

            //start with a random node first to avoid getting stuck on a bad node
            if (i == 0) {
                var random = Math.floor(Math.random() * nodes.length);
            }
            const response = await fetch(nodes[random], {
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
        hook.send(embed).then(() => console.log('Sent webhook successfully!'))
        .catch(err => console.log(err.message));
    }
    catch (err) {
        console.log(chalk.red("Discord Webhook Error"));
        //close to prevent infinite loop
        process.exit(1);
    }
    
}

async function storeHash(hash, username) {
    let db = client.db(dbName);
    let collection = db.collection('hashes');
    await collection.insertOne({hash: hash, username: username, time: Date.now()});
    console.log('Hash ' + hash + ' stored');
}

//engineering upgrade
async function engineering(username, quantity) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({ username : username });

        if (!user) {
            return;
        }

        var cost = Math.pow(user.engineering, 2);
        var newrate = user.minerate + (user.minerate * 0.1);
        var newEngineer = user.engineering + 1;

        while (true) {
            if (quantity == cost){  
                await collection.updateOne({username: username}, {$set: {minerate: newrate, engineering: newEngineer}});
            }   
            else {
                return;
            }

            let userCheck = await collection.findOne({ username : username });
            if (userCheck.engineering == newEngineer && userCheck.minerate == newrate) {
                await webhook('Engineering Upgrade', username + ' has upgraded their engineering to ' + newEngineer, '#86fc86')
                return;
            }
            else {
                console.log('Engineering upgrade failed for ' + username);
            }
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }

}
//defense upgrade
async function defense(username, quantity) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({ username : username });

        if (!user) {
            return;
        }

        while (true) {
            let cost = Math.pow(user.defense/10, 2);
            var newDefense = user.defense + 10;
            if (quantity == cost){
                await collection.updateOne({username : username}, {$set: {defense: newDefense}}); 
            }
            else {
                return;
            }

            let userCheck = await collection.findOne({ username : username });
            if (userCheck.defense == newDefense) {
                webhook('Upgrade', username + ' upgraded defense to ' + newDefense, '#86fc86');
                return;
            }
            else {
                console.log('Defense upgrade failed for ' + username);
            }
        
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }
}

//damage upgrade
async function damage(username, quantity) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({ username : username });

        if (!user) {
            return;
        }

        while (true) {
            var cost = Math.pow(user.damage/10, 2);
            var newDamage = user.damage + 10;

            if (quantity == cost){
                await collection.updateOne({username: username}, {$set: {damage: newDamage}});
            }
            else {
                return;
            }

            let userCheck = await collection.findOne({ username : username });
            if (userCheck.damage == newDamage) {
                webhook('Upgrade', username + ' upgraded damage to ' + newDamage, '#86fc86');
                return;
            }
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }

}

//contributor upgrade
async function contribute(username, quantity) {
    try{
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
            var newFavor = user.favor + qty;
            var newGlobalFavor = user.globalFavor + qty;

            await collection.updateOne({username: username}, {$set: {favor: newFavor}});

            var userCheck = await collection.findOne({ username : username });
            if (userCheck.favor == startFavor + qty) {
                webhook("New Contribution", "User " + username + " contributed " + qty.toString() + " favor", '#c94ce6')
                var stats = db.collection('stats');
                await stats.updateOne({date: "global"}, {$set: {globalFavor: newGlobalFavor}});
                return;
            }
            
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
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


var lastevent = Date.now();
//aysncfunction to start listening for events
async function listen() {
    await findNode();
    const ssc = new SSC(node);
    ssc.stream((err, res) => {
        lastevent = Date.now();
        if (res['transactions']) {
            //loop through transactions and look for events
            try{
                for (var i = 0; i < res['transactions'].length; i++) {
                    //check if contract is token
                    if (res['transactions'][i]['contract'] == 'tokens' && res['transactions'][i]['action'] == 'transfer') {
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
                            var hashStore = payload.memo;
                            //console.log(res['transactions'][i]);

                            var isComplete = checkTx(res['transactions'][i].transactionId);
                            //wait for promise from isComplete then log
                            isComplete.then(function(result) {
                                //console.log(result);
                                if (!result) {
                                    return
                                }     
                                else{           
                                                
                                    //check if memo is engineering
                                    if (memo.event == 'terracore_engineering'){
                                        engineering(from, quantity);
                                        storeHash(hashStore, from);
                                        return;
                                    }
                                    else if (memo.event == 'terracore_health'){
                                        health(from, quantity);
                                        storeHash(hashStore, from);
                                        return;
                    
                                    }
                                    else if (memo.event == 'terracore_damage'){
                                        damage(from, quantity);
                                        storeHash(hashStore, from);
                                        return;
                                    }
                                    else if (memo.event == 'terracore_defense'){
                                        defense(from, quantity);
                                        storeHash(hashStore, from);
                                        return;
                                    }
                                    else if (memo.event == 'terracore_contribute'){
                                        contribute(from, quantity);
                                        storeHash(hashStore, from);
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
                            var hashStore = payload.memo;
                            isComplete.then(function(result) {
                                console.log(result);
                                if (!result) {
                                    //no action
                                    return
                                }     
                                else{
                                    webhook('New Stake', sender + ' has staked ' + qty + ' ' + "SCRAP", '#FFA500');
                                    storeHash(hashStore, sender);
                                    return;
                                }                    
                            });

                        
                        }


                    }
                }
            }
            catch(err){
                console.log(err);
            }
        }
        else {
            console.log('No transactions');
        }

    });
}


listen();
lastevent = Date.now();
//kill process if no events have been received in 30 seconds
setInterval(function() {
    console.log('Last event: ' + (Date.now() - lastevent) + ' ms ago');
    if (Date.now() - lastevent > 12000) {
        console.log('No events received in 12 seconds, shutting down so pm2 can restart');
        process.exit();
    }
}, 1000);






