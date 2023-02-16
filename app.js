const SSC = require('sscjs');
const mongodb = require('mongodb');
const fetch = require('node-fetch');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
require('dotenv').config();

//connect to Webhook
const hook = new Webhook(process.env.DISCORD_WEBHOOK);

//connect to mongodb
const MongoClient = mongodb.MongoClient;
const url = process.env.MONGO_URL;
const dbName = 'terracore';
const SYMBOL = 'SCRAP';
const wif = process.env.ACTIVE_KEY;


//find node to use
const nodes = ["https://herpc.dtools.dev", "https://engine.rishipanthee.com", "https://api.primersion.com"];
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
    let client = await MongoClient.connect(url, { useNewUrlParser: true });
    let db = client.db(dbName);
    let collection = db.collection('hashes');
    let result = await collection.insertOne({hash: hash, username: username, time: Date.now()});
    console.log('Hash ' + hash + ' stored');
}
//defense upgrade
async function defense(username, quantity) {
    let client = await MongoClient.connect(url, { useNewUrlParser: true });
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

        //check if update was successful
        let userCheck = await collection.findOne({ username : username });
        if (userCheck.defense == user.defense + 10) {
            break;
        }
     
    }
}
//engineering upgrade
async function engineering(username, quantity) {
    let client = await MongoClient.connect(url, { useNewUrlParser: true });
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
            await collection.updateOne({username: username}, {$inc: {engineering: 1}});
            await collection.updateOne({username: username }, {$set: {minerate: newrate}});
            webhook('Engineering Upgrade', username + ' has upgraded their engineering to ' + (user.engineering + 1), '#86fc86')
        }

        //check if update was successful
        let userCheck = await collection.findOne({ username : username });
        if (userCheck.engineering == user.engineering + 1 && userCheck.minerate == newrate) {
            break;
        }
    }

}
//health upgrade
async function health(username, quantity) {
    let client = await MongoClient.connect(url, { useNewUrlParser: true });
    let db = client.db(dbName);
    let collection = db.collection('players');
    let user = await collection.findOne({ username : username });

    //check if user exists
    if (!user) {
        return;
    }
    let cost = Math.pow(user.health/10, 2);

    if (quantity == cost){
        let result = await collection.updateOne({username: username}, {$inc: {health: 10}});
        webhook('Health Upgrade', username + ' has upgraded their health to ' + (user.health + 10), '#86fc86');
    }
}

//damage upgrade
async function damage(username, quantity) {
    let client = await MongoClient.connect(url, { useNewUrlParser: true });
    let db = client.db(dbName);
    let collection = db.collection('players');
    let user = await collection.findOne({ username : username });

    //check if user exists
    if (!user) {
        return;
    }

    let cost = Math.pow(user.damage/10, 2);

    if (quantity == cost){
        let result = await collection.updateOne({username: username}, {$inc: {damage: 10}});
        webhook('Damage Upgrade', username + ' has upgraded their damage to ' + (user.damage + 10), '#86fc86');
    }
}

//contributor upgrade
async function contribute(username, quantity) {
    let client = await MongoClient.connect(url, { useNewUrlParser: true });
    let db = client.db(dbName);
    let collection = db.collection('players');
    let user = await collection.findOne({username: username});

    //check if user exists
    if (!user) {
        return;
    }

    let qty = parseFloat(quantity);
    //add quantity to favor
    await collection.updateOne({username: username}, {$inc: {favor: qty}});
    //load stats collection
    let stats = db.collection('stats');
    //todays date
    var date = new Date().toISOString().slice(0, 10);

    //add qty to current favor
    await stats.updateOne({date: date}, {$inc: {currentFavor: qty}});

    //update date glboal in stats collection and increment current favor
    let collection2 = db.collection('stats');
    await collection2.updateOne({date: "global"}, {$inc: {currentFavor: qty}});


    //webhook
    webhook("New Contribution", "User " + username + " contributed " + qty.toString() + " favor", '#c94ce6')


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

                        //log tx
                        console.log(res['transactions'][i]);
                        //check if memo is engineering
                        if (memo.event == 'engineering'){
                            engineering(from, quantity);
                        }
                        else if (memo.event == 'health'){
                            health(from, quantity);
                        }
                        else if (memo.event == 'damage'){
                            damage(from, quantity);
                        }
                        else if (memo.event == 'defense'){
                            defense(from, quantity);
                        }
                        else if (memo.event == 'contribute'){
                            contribute(from, quantity);
                        }
                        else{
                            console.log('Unknown event');
                        }
                        
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
