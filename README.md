# Terracore-Hive-Engine
 
git clone https://github.com/CryptoGnome/Terracore-Hive-Engine.git

cd Terracore-Hive-Engine

npm install

# update
-------
cd Terracore-Hive-Engine

git stash

git pull

# dev
---------
cd Terracore-Hive-Engine; pm2 stop 0; git pull; sleep 0.2; pm2 start 0; pm2 logs;
