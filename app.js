const SSC = require('sscjs');
const { MongoClient, MongoTopologyClosedError } = require('mongodb');
const fetch = require('node-fetch');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const { api } = require('@hiveio/hive-js');;
require('dotenv').config();

//connect to Webhook
const hook = new Webhook(process.env.DISCORD_WEBHOOK);
const market_hook = new Webhook(process.env.MARKET_WEBHOOK);
const boss_hook = new Webhook(process.env.BOSS_WEBHOOK);
const wif = process.env.ACTIVE_KEY;
const dbName = 'terracore';
var client = new MongoClient(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 7000 });


//find node to use
const nodes = ["https://engine.deathwing.me/", "https://engine.rishipanthee.com", "https://herpc.dtools.dev", "https://api.primersion.com", "https://herpc.kanibot.com", "https://ctpmain.com", "https://he.sourov.dev", "https://he.atexoras.com:2083", "https://herpc.actifit.io", "https://ha.herpc.dtools.dev"];
var node;

async function findNode() {
    //look in mongo for last node used
    var currentNode;
    /*
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
    console.log('Current node: ' + currentNode);
    node = nodes[currentNode];
    */

    node = nodes[0];
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

async function marketWebhook(title, message, color) {
    const embed = new MessageBuilder()
        .setTitle(title)
        .addField('Message: ', message, true)
        .setColor(color)
        .setTimestamp();
    try {
        market_hook.send(embed).then(() => console.log('Sent webhook successfully!'))
        .catch(err => console.log(err.message));
    }
    catch (err) {
        console.log(chalk.red("Discord Webhook Error"));
    }   
}
async function bossWebhook(title, message, rarity) {
    //check if stats are null
    var embed;
    var id;
    //color select based on rarity
    switch (rarity) {
        case 'common':
            color = '#bbc0c7';
            id = 'common_crate';
            break;
        case 'uncommon':
            color = '#538a62';
            id = 'uncommon_crate';
            break;
        case 'rare':
            color = '#2a2cbd';
            id = 'rare_crate';
            break;
        case 'epic':
            color = '#7c04cc';
            id = 'epic_crate';
            break;
        case 'legendary':
            color = '#d98b16';
            id = 'legendary_crate';
            break;
    }

    //set image
    embed = new MessageBuilder()
        .setTitle(title)
        .addField('Message: ', message, true)
        .setColor(color)
        .setThumbnail(`https://terracore.herokuapp.com/images/${id}.png`)
        .setTimestamp();
    
    try {
        await boss_hook.send(embed);
        console.log('Sent webhook successfully!');
    } catch (err) {
        console.log(chalk.red("Discord Webhook Error: ", err.message));
    }

}
async function storeHash(hash, username, amount) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('hashes');
        await collection.insertOne({hash: hash, username: username, amount: parseFloat(amount), time: Date.now()});
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
        console.log('Rejected Hash ' + hash + ' stored');
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
                let update = await collection.updateOne({username: username}, {$set: {engineering: newEngineer}, $inc: {version: 1}});
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
        //if we get here, we've tried maxAttempts times
        return false;
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
                let update = await collection.updateOne({username: username}, {$set: {defense: newDefense}}, {$inc: {version: 1}});
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
        return false;


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
                let update = await collection.updateOne({username: username}, {$set: {damage: newDamage}}, {$inc: {version: 1}});
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
        return false;
                
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
            let update = await collection.updateOne({username: username}, {$set: {favor: newFavor}}, {$inc: {version: 1}});
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
        return false;

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

////////////////////////////////////////////////////
////////////
/////////// Planet Functions
//////////
///////////////////////////////////////////////////
async function mintCrate(owner, _planet){
    try{
        //load crate collection
        let db = client.db(dbName); 
        var collection = db.collection('crates');

        //roll a random number 1 - 1000
        var roll = Math.floor(Math.random() * 1001)
        console.log('Item Roll: ' + roll);
        let rarity;

        if (_planet == 'Oceana') {
            if (roll <= 950) { rarity = 'uncommon'; } // 95 %
            else if (roll > 950 && roll <= 985) { rarity = 'rare'; } // 3.5 % 
            else if (roll > 985 && roll <= 995) { rarity = 'epic'; } // 1 %
            else if (roll > 995 && roll <= 1000) { rarity = 'legendary'; } // .5 %
        }
        if (_planet == 'Celestia') {
            if (roll <= 900) { rarity = 'uncommon'; } // 90 %
            else if (roll > 900 && roll <= 970) { rarity = 'rare'; } // 7 %
            else if (roll > 970 && roll <= 992.5) { rarity = 'epic'; } // 2.25 %
            else if (roll > 992.5 && roll <= 1000) { rarity = 'legendary'; } // .75 %
        }
        


        let count = await db.collection('crate-count').findOne({supply: 'total'});

        //create crate object
        let crate = new Object();
        crate.name = rarity.charAt(0).toUpperCase() + rarity.slice(1) + ' Loot Crate';
        crate.rarity = rarity;
        crate.owner = owner;
        crate.item_number = count.count + 1;
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
        collection.insertOne(crate);
        console.log('Minted crate: ' + crate.name + ' with rarity: ' + crate.rarity + ' with owner: ' + crate.owner + ' with item number: ' + crate.item_number);
        bossWebhook('Crate Dropped!', crate.name + ' with rarity: ' + crate.rarity + ' has dropped from a boss for ' + crate.owner + '!' + ' Item Number: ' + crate.item_number, crate.rarity);
        await db.collection('crate-count').updateOne({supply: 'total'}, {$inc: {count: 1}});

        //log to nft-drops in mongoDB
        await db.collection('nft-drops').insertOne({name: crate.name, rarity: crate.rarity, owner: crate.owner, item_number: crate.item_number, purchased: false, time: new Date()});
        return crate;

    }
    catch(err){
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection is closed');
            process.exit(1);
        }
        else{
            console.log(err);
        }
    }
}
//create a fucntion to roll to see if user gets a crate
async function bossFight(username, _planet) {
    try{
        
        //load player collection
        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({ username: username });
        var luck = 0;
        //check if user exists
        if (user == null) {
            console.log('User: ' + username + ' does not exist');
            return false;
        }
        else {
            //get luck
            luck = user.stats.luck;

            //call planets collection to see if the user can access the planet and has the fuel
            let planets = db.collection('planets');
            let planet = await planets.findOne({ username: username });
            //check the planets array to see if the user has access to the planet (it just needs to be in the array)
            //loop through the planets array to see if the user has access to the planet
            var found = false;
            var index = 0;
            for (var i = 0; i < planet.planets.length; i++) {
                if (planet.planets[i].name == _planet) {
                    found = true;
                    index = i;
                    break;
                }
            }
            //if the user has access to the 
            if (found == true) {

                //check if the last battle was more than 4 hours ago
                if (Date.now() - planet.planets[index].lastBattle < 14400000) {
                    console.log('User: ' + username + ' has already battled the boss in the last 4 hours');
                    return false;
                }
                else{
                
                    //roll a random number 0 -100 as a float
                    var roll = Math.random() * 100;

                    //if roll is greater than drop chance then return false
                    if (roll > luck) {
                        console.log("------  BOSS MISSED: Boss Drop Roll: " + roll + " | " + " Drop Max Roll: " + luck + " ------");
                        //set new lastBattle for _planet in planets array
                        await planets.updateOne({ username: username }, { $set: { ["planets." + index + ".lastBattle"]: Date.now() } });
                        await db.collection('boss-log').insertOne({username: username, planet: _planet, result: false, roll: roll, luck: luck, time: Date.now()});
                        return false;
                    }
                    else {
                        console.log("------  ITEM FOUND: Boss Drop Roll: " + roll + " | " + " Drop Max Roll: " + luck + " ------");
                        //set new lastBattle for _planet in planets array
                        await planets.updateOne({ username: username }, { $set: { ["planets." + index + ".lastBattle"]: Date.now() } });
                        await mintCrate(username, _planet);
                        await db.collection('boss-log').insertOne({username: username, planet: _planet, result: true, roll: roll, luck: luck, time: Date.now()});
                        return true;
                    }
                }

            }
            else {
                console.log('User: ' + username + ' does not have access to planet: ' + _planet);
                return false;
            }


        }
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
        //finc count in supply:total
        let count = await db.collection('crate-count').findOne({supply: 'total'});
        
        crate.item_number = count.count + 1;
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
        //send webhook to discord green
        marketWebhook('Crate Purchased', crate.name + ' with rarity: ' + crate.rarity + ' with owner: ' + crate.owner + ' with item number: ' + crate.item_number, '#00ff00');
        //inc crate count in crate-count db
        await db.collection('crate-count').updateOne({supply: 'total'}, {$inc: {count: 1}});
        //add to nft-drops log
        await db.collection('nft-drops').insertOne({name: crate.name, rarity: crate.rarity, owner: crate.owner, item_number: crate.item_number, purchased: true, time: new Date()});
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
            let transaction = transactions[i];
            if(transaction.type == 'engineering') {
                var result = await engineering(transaction.username, transaction.quantity);
                if (result) {
                    await storeHash(transaction.hash, transaction.username, transaction.quantity);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'contribute') {
                var result2 = await contribute(transaction.username, transaction.quantity);
                if (result2) {
                    await storeHash(transaction.hash, transaction.username, transaction.quantity);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'defense') {
                var result3 = await defense(transaction.username, transaction.quantity);
                if (result3) {
                    await storeHash(transaction.hash, transaction.username, transaction.quantity);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'damage') {
                var result4 = await damage(transaction.username, transaction.quantity);
                if (result4) {
                    await storeHash(transaction.hash, transaction.username, transaction.quantity);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'buy_crate') {
                var result5 = await buy_crate(transaction.username, transaction.quantity);
                if (result5) {
                    await storeHash(transaction.hash, transaction.username, transaction.quantity);
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
                                }
                                else if (memo.event == 'terracore_damage'){
                                    sendTransaction(from, quantity, 'damage', hashStore);
                                }
                                else if (memo.event == 'terracore_defense'){
                                    sendTransaction(from, quantity, 'defense', hashStore);
                                }
                                else if (memo.event == 'terracore_contribute'){
                                    sendTransaction(from, quantity, 'contribute', hashStore);
                                }
                                else if (memo.event == 'tm_buy_crate'){
                                    console.log('"Buy Crate" event detected');
                                    sendTransaction(from, quantity, 'buy_crate', hashStore);
                                }
                                else{
                                    console.log('Unknown event');
                                }
                                        
                            }

                            else if (payload.to == 'null' && payload.symbol == 'FLUX') {
                
                                try{
                                    var _memo = {
                                        event: payload.memo.hash.split('-')[0],
                                        planet: payload.memo.planet,
        
                                    }
                            
                                    //check if memo is terracore_boss_fight and if so call check planet
                                    if (_memo.event == 'terracore_boss_fight') {
                                        //check if transaction failed
                                        if (res['transactions'][i].logs.includes('errors')) {
                                            storeRejectedHash(hashStore, from);
                                            return;
                                        }
                                        //check if planet is Oceana
                                        if (_memo.planet == 'Oceana' && payload.quantity === '1') {
                                            //let finish then store hash
                                            let sender = res['transactions'][i]['sender'];
                                            let hash = payload.memo.hash;
                                            let qty = payload.quantity;
                                            let planet = _memo.planet;
                                            bossFight(sender, planet, hash.split('-')[1]).then(function(result){
                                                storeHash(hash, sender, qty);
                                            });
                                        }
                                        else if (_memo.planet == 'Celestia' && payload.quantity === '1') {
                                            //let finish then store hash
                                 
                                        }
                                
                                    }
                                  
                                }
                                catch(err){
                                    console.log(err);
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
                                }
                                webhook('New Stake', sender + ' has staked ' + qty + ' ' + "SCRAP", '#FFA500');
                                storeHash(hashStore, sender, qty);
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
    console.log('Last event: ' + (Date.now() - lastevent) + ' ms ago');
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
        //console.log('HeartBeat: ' + (Date.now() - lastCheck) + 'ms ago');
        heartbeat = 0;
    }
    if (Date.now() - lastCheck > 20000) {
        console.log('Error : No events received in 20 seconds, shutting down so PM2 can restart & try to reconnect to Resolve...');
        client.close();
        process.exit();
    }
}, 1000);

listen();


