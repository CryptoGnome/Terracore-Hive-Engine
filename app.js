const SSC = require('sscjs');
const { MongoClient, MongoTopologyClosedError } = require('mongodb');
const fetch = require('node-fetch');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const { api } = require('@hiveio/hive-js');;
require('dotenv').config();

//connect to Webhook
const hook = new Webhook(process.env.DISCORD_WEBHOOK);

const dbName = 'terracore';
var client = new MongoClient(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 7000 });


//find node to use
const nodes = ["https://engine.rishipanthee.com", "https://herpc.dtools.dev", "https://api.primersion.com", "https://herpc.kanibot.com", "https://ctpmain.com", "https://he.sourov.dev", "https://he.atexoras.com:2083", "https://herpc.actifit.io", "https://ha.herpc.dtools.dev"];
var node;

async function findNode() {
    //look in mongo for last node used
    var currentNode;
    try {
        let db = client.db(dbName);
        let collection = db.collection('he-node');
        let lastNode = await collection.findOne({ "global" : { $exists: true } });
        if (lastNode) {
            currentNode = lastNode.lastnode + 1;
            if (currentNode > nodes.length - 1) {
                currentNode = 0;
            }
            //update node in mongo
            await collection.updateOne({global: true}, {$set: {lastnode: currentNode}});
        }
        else {
            currentNode = 0;
            //store node in mongo
            await collection.insertOne({global: true, lastnode: currentNode});
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
    console.log('Current node: ' + currentNode);
    node = nodes[currentNode];
    while (true) {
        try{
            const response = await fetch(node);
            const data = await response.json();
            if (data) {
                console.log('Node is online: ' + node);
                break;
            }
            else {
                console.log('Node is offline');
                node = nodes[Math.floor(Math.random() * nodes.length)];
                console.log('Checking another node: ' + node);
            }
        }
        catch (err) {
            console.log('Node is offline');
            node = nodes[Math.floor(Math.random() * nodes.length)];
            console.log('Checking another node: ' + node);
            lastevent = Date.now();
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
    }   
}
async function storeHash(hash, username) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('hashes');
        await collection.insertOne({hash: hash, username: username, time: Date.now()});
        console.log('Hash ' + hash + ' stored');
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
async function storeRejectedHash(hash, username) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('rejectedHashes');
        await collection.insertOne({hash: hash, username: username, time: Date.now()});
        console.log('Hash ' + hash + ' stored');
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
//engineering upgrade
async function engineering(username, quantity) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({ username : username });

        if (!user) {
            return true;
        }
        let cost = Math.pow(user.engineering, 2);
        let newEngineer = user.engineering + 1;


        let maxAttempts = 5;
        let delay = 500;
        for (let i = 0; i < maxAttempts; i++) {
            if (quantity == cost){
                //inc version & set engineering to new level
                let update = await collection.updateOne({username: username}, {$inc: {version: 1}, $set: {engineering: newEngineer}});
                if(update.acknowledged == true && update.modifiedCount == 1) {
                    webhook('Engineering Upgrade', username + ' upgraded engineering to level ' + newEngineer, 0x00ff00);
                    return true;
                }
            }
            else {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2.5; // exponential backoff  
        }
        //if we get here, we've tried maxAttempts
        return true;
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            webhook('Error', 'Error upgrading engineering for ' + username + ' ' + err, '#ff0000');
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
            return true;
        }

        let cost = Math.pow(user.defense/10, 2);
        let newDefense = user.defense + 10;

        let maxAttempts = 5;
        let delay = 500;
        for (let i = 0; i < maxAttempts; i++) {
            if (quantity == cost){ 
                let update = await collection.updateOne({username: username}, {$inc: {version: 1}, $set: {defense: newDefense}});
                if(update.acknowledged == true && update.modifiedCount == 1) {
                    webhook('Defense Upgrade', username + ' upgraded defense to ' + newDefense, '#00ff00');
                    return true;
                }
            }
            else {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2.5; // exponential backoff  
        }
        //if we get here, we've tried maxAttempts times
        return true;


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
            return true;
        }

        let cost = Math.pow(user.damage/10, 2);
        let newDamage = user.damage + 10;

        let maxAttempts = 5;
        let delay = 500;
        for (let i = 0; i < maxAttempts; i++) {
            if (quantity == cost){ 
                let update = await collection.updateOne({username: username}, {$inc: {version: 1}, $set: {damage: newDamage}});
                if(update.acknowledged == true && update.modifiedCount == 1) {
                    webhook('Damage Upgrade', username + ' upgraded damage to ' + newDamage, '#00ff00');
                    return true;
                }
            }
            else {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2.5; // exponential backoff  
        }
        //if we get here, we've tried maxAttempts times
        return true;
                
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
            return true;
        }

        //check starting favor
        let qty = parseFloat(quantity);
        let newFavor = user.favor + qty;

        let maxAttempts = 3;
        let delay = 500;
        for (let i = 0; i < maxAttempts; i++) {
            let update = await collection.updateOne({username: username}, {$inc: {version: 1}, $set: {favor: newFavor}});
            if(update.acknowledged == true && update.modifiedCount == 1) {
                webhook('Contributor', username + ' contributed ' + qty + ' favor', '#00ff00');
                //update global favor 
                await globalFavorUpdate(qty);
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2.5; // exponential backoff  
        }
        //if we get here, we've tried maxAttempts times
        return true;

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

//update global favor
async function globalFavorUpdate(qty){
    let db = client.db(dbName);
    const stats = db.collection('stats');
    let maxAttempts = 3;
    let delay = 500;

    for (let i = 0; i < maxAttempts; i++) {
        const result = await stats.updateOne({ date: 'global' }, { $inc: { currentFavor: qty } });
        if (result.acknowledged == true && result.modifiedCount == 1) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5; // exponential backoff
    }
    return false;

}




//////////////////////////////////////////////////////////////////////////////
////NFT FUNCTIONS/////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//THESE ARE TEST FUNCTIONS FOR THE NFT MARKETPLACE IF YOU SEND SCRAP BEFORE LAUNCH YOU WILL LOOSE THE NFTS THAT POPULATE

async function buy_crate(owner, quantity){
    try{
        //load crate collection
        let db = client.db(dbName); 
        var collection = db.collection('price_feed');
        var price = await collection.findOne({date: "global"});

        if (quantity == price.price)
        {
            var rarity = 'common';
        }
        else {
            return true;
        }

        collection = db.collection('crates');
        //create crate object
        let crate = new Object();
        crate.name = rarity.charAt(0).toUpperCase() + rarity.slice(1) + ' Loot Crate';
        crate.rarity = rarity;
        crate.owner = owner;
        crate.item_number = await collection.countDocuments() + 1;
        crate.image = "https://terracore.herokuapp.com/images/" + rarity + '_crate.png';
        crate.equiped = false;
        //add market object to crate
        let market = new Object();
        market.listed = false;
        market.price = 0;
        market.seller = null;
        market.created = 0;
        market.expires = 0;
        market.sold = 0;

        //add market object to crate
        crate.market = market;

        //add crate to database
        await collection.insertOne(crate);
        console.log('Create Purchaed: ' + crate.name + ' with rarity: ' + crate.rarity + ' with owner: ' + crate.owner + ' with item number: ' + crate.item_number);
        //send webhook to discord
        webhook('New Crate Purchase', 'New crate purchased by ' + owner + ' with rarity: ' + crate.rarity, ' for ' + quantity + ' SCRAP', '#86fc86');
        return true;
    }
    catch(err){
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection is closed');
            process.exit(1);
        }
        else{
            console.log(err);
            return false;
        }
    }
}

//////////////////////////////////////////////////////////////////////////////
////QUE AND SEND TRANSACTIONS/////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//create a function where you can send transactions to be queued to be sent
async function sendTransaction(username, quantity, type, hash){
    try{
        let db = client.db(dbName);
        let collection = db.collection('he-transactions');
        let result = await collection.insertOne({username: username, quantity: quantity, type: type, hash: hash, time: new Date()});
        console.log('Transaction ' + result.insertedId + ' added to queue');
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
//create a function that can be called to send all transactions in the queue
async function sendTransactions() {
    try{
        let db = client.db(dbName);
        let collection = db.collection('he-transactions');
        let transactions = await collection.find({}).toArray();
        for (let i = 0; i < transactions.length; i++) {
            lastCheck = Date.now();
            lastevent = Date.now();
            let transaction = transactions[i];
            if(transaction.type == 'engineering') {
                let result = await engineering(transaction.username, transaction.quantity);
                if (result) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'contribute') {
                let result2 = await contribute(transaction.username, transaction.quantity);
                if (result2) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'defense') {
                var result3 = await defense(transaction.username, transaction.quantity);
                if (result3) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'damage') {
                var result4 = await damage(transaction.username, transaction.quantity);
                if (result4) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'buy_crate') {
                var result5 = await buy_crate(transaction.username, transaction.quantity);
                if (result5) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                    
                }
            }
            else{
                console.log('unknown transaction type');
                await collection.deleteOne({_id: transaction._id});
            } 
        }
        return true;
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
            return true;
        }
    }
}
//call send transactions and wait for it to return true then call check transactions
async function checkTransactions() {
    //console.log('Checking transactions');
    let done = await sendTransactions();
    if(done) {
        lastCheck = Date.now();
        setTimeout(checkTransactions, 1000);
    }
}


var lastevent = Date.now();
var lastCheck = Date.now();
//aysncfunction to start listening for events
async function listen() {
    await findNode();
    checkTransactions();
    const ssc = new SSC(node);
    ssc.stream((err, res) => {
        try{
            if (res['transactions']) {
                lastevent = Date.now();
                //loop through transactions and look for events
                try{
                    for (var i = 0; i < res['transactions'].length; i++) {
                        //check if contract is token
                        if (res['transactions'][i]['contract'] == 'tokens' && res['transactions'][i]['action'] == 'transfer') {
                            //convert payload to json
                            var payload = JSON.parse(res['transactions'][i]['payload']);
                            //check if to is "null" which is burn address
                            if (payload.to == 'null' && payload.symbol == 'SCRAP') {
                                //get memo 
                                var memo = {
                                    event: payload.memo.split('-')[0],
                                    hash: payload.memo.split('-')[1],
                                }
                                var from = res['transactions'][i]['sender'];
                                var quantity = payload.quantity;
                                var hashStore = payload.memo;

                                if (res['transactions'][i].logs.includes('errors')) {
                                    storeRejectedHash(hashStore, from);
                                    return;
                                }

                                //check if memo is engineering
                                if (memo.event == 'terracore_engineering'){
                                    sendTransaction(from, quantity, 'engineering', hashStore);
                                    return;
                                }
                                else if (memo.event == 'terracore_damage'){
                                    sendTransaction(from, quantity, 'damage', hashStore);
                                    return;
                                }
                                else if (memo.event == 'terracore_defense'){
                                    sendTransaction(from, quantity, 'defense', hashStore);
                                    return;
                                }
                                else if (memo.event == 'terracore_contribute'){
                                    sendTransaction(from, quantity, 'contribute', hashStore);
                                    return;
                                }
                                else if (memo.event == 'tm_buy_crate'){
                                    sendTransaction(from, quantity, 'buy_crate', hashStore);
                                    return;
                                }

                                else{
                                    console.log('Unknown event');
                                    return;
                                }
                                        
                            }

                        }
                        else if (res['transactions'][i]['contract'] == 'tokens' && res['transactions'][i]['action'] == 'stake') {
                            //convert payload to json
                            var payload = JSON.parse(res['transactions'][i]['payload']);

                            //check if symbol is scrap
                            if (payload.symbol == 'SCRAP') {
                                var sender = res['transactions'][i]['sender'];
                                var qty = payload.quantity;
                                var hashStore = payload.memo;
                                if (res['transactions'][i].logs.includes('errors')) {
                                    storeRejectedHash(hashStore, sender);
                                    return;
                                }
                                webhook('New Stake', sender + ' has staked ' + qty + ' ' + "SCRAP", '#FFA500');
                                storeHash(hashStore, sender);
                                return;
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
        }
        catch(err){
            ///check if it is a type error
            if (err instanceof TypeError) {
                //nothing
            }
            else {
                console.log(err);
            }
        }

    });
}


//kill process if no events have been received in 30 seconds
setInterval(function() {
    //console.log('Last event: ' + (Date.now() - lastevent) + ' ms ago');
    if (Date.now() - lastevent > 20000) {
        console.log('No events received in 20 seconds, shutting down so pm2 can restart');
        client.close();
        process.exit(1);
    }
}, 1000);

var heartbeat = 0;
setInterval(function() {
    heartbeat++;
    if (heartbeat == 5) {
        //log how man seconds since last lastCheck
        console.log('HeartBeat: ' + (Date.now() - lastCheck) + 'ms ago');
        heartbeat = 0;
    }
    if (Date.now() - lastCheck > 30000) {
        console.log('Error : No events received in 30 seconds, shutting down so PM2 can restart & try to reconnect to Resolve...');
        client.close();
        process.exit();
    }
}, 1000);

listen();


