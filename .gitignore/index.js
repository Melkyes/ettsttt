const Discord = require("discord.js");
const client = new Discord.Client();
const CONFIG = require("./storage/config.json");
const PREFIX = CONFIG.defaultPrefix;
const TOKEN = CONFIG.token;
const SERVERNAME = CONFIG.serverName;
const helppage = new Discord.RichEmbed()
  .setColor('#275BF0')
  .setTitle("Page d'aide:")
  .setDescription("*help - affiche la page d'aide\n*say [votre phrase] - Le bot écrit votre phrase\n*purge 1-99 - Supprime le nombre choisi (compris entre 1 et 99)\n*ban @user#0000 - banni l\'utilisateur mentionné\n*kick @user#0000 - kick l\'utilisateur mentionné\n*avatar - affiche l\'avatar de l\'utilisateur")


client.on('ready', () => {
  console.log(`Connecté en tant que : ${client.user.tag}!`);
  client.user.setPresence({
        game: {
            name: ' *help',
            type: 'Utilisé'
        }
    });
});



const { Client, Util } = require('discord.js');
const { D_TOKEN, GOOGLE_API_KEY } = require('./config');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const bot = new Client({ disableEveryone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

bot.on('warn', console.warn);

bot.on('error', console.error);


bot.on('disconnect', () => console.log('Je me suis juste deconnecté, je voulais être sur que vous le saviez, je me reconnecte..'));

bot.on('reconnecting', () => console.log('Je me suis reconnecté'));

bot.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length)

	if (command === 'play') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('Je suis désolée mais vous devez être dans un channel vocal!');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('Je ne peux pas me connectez à votre channel , veuillez vérifié que j\'ai les droits pour m\'y connecté!');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('Je ne peux pas parlez dans votre channel, veuillez vérifié que j\'ai les droits pour y parler!');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`✅ Playlist: **${playlist.title}** à été ajouté à la queue!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**Song selection:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
S\'ilvousplait, donnez une valeur entre 1-10.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('Veuillez donnez une bonne valeur, annulation de la commande.');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 Je ne peux pas obtenir de résultat.');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'skip') {
		if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'êtes pas dans un channel vocal!');
		if (!serverQueue) return msg.channel.send('Aucune musique à skip.');
		serverQueue.connection.dispatcher.end('La musique à bien été skip');
		return undefined;
	} else if (command === 'stop') {
		if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'êtes pas dans un channel vocal!');
		if (!serverQueue) return msg.channel.send('Aucune musique à arreté.');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('La musique à bien été arreté.');
		return undefined;
	} else if (command === 'volume') {
		if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'êtes pas dans un channel vocal!');
		if (!serverQueue) return msg.channel.send('Aucune musique est en cours');
		if (!args[1]) return msg.channel.send(`Le volume actuel est de : **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`J'ai mis le volume à : **${args[1]}**`);
	} else if (command === 'np') {
		if (!serverQueue) return msg.channel.send('Aucune musique est en cours');
		return msg.channel.send(`🎶 - **${serverQueue.songs[0].title} est en cours de lecture**`);
	} else if (command === 'queue') {
		if (!serverQueue) return msg.channel.send('Aucune musique est en cours');
		return msg.channel.send(`
__**Song queue:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
**En cours:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pause') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ Musique mise en pause!');
		}
		return msg.channel.send('Aucune musique est en cours');
	} else if (command === 'resume') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶ la musique continue !');
		}
		return msg.channel.send('Aucune musique est en cours');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`Je ne peux pas rejoindre le channel vocal: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`Je ne peux pas rejoindre le channel vocal: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`✅ **${song.title}** à bien été ajouté à la queue!`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Le stream n\'est plus en cours.') console.log('Song fini.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶 Lecture en cours de: **${song.title}**`);
}





client.on('message', message => {
  if (!message.guild) return;

  if (message.content.startsWith('*ban')) {
    const user = message.mentions.users.first();
    if (user) {
      const member = message.guild.member(user);
      if (member) {
        member.ban('Optional reason that will display in the audit logs').then(() => {
          message.reply(`L'utilisateur ${user.tag} à bien été banni`);
        }).catch(err => {
          message.reply('Je ne peux pas bannir cet utilisateur');
          console.error(err);
        });
      } else {
        message.reply('Cet utilisateur n\'est pas sur le discord');
      }
    } else {
      message.reply('Vous n\'avez pas mentionnez la personne à bannir.');
    }
  }
});


function purgeCommand(message, adminRole, prefix, args) {
  async function purge(){
    let amount = parseInt(args.substring(6))

    if (amount == undefined) {
      message.channel.send(`:x: S'il vous plait, donnez une valeur. Usage : \'*purge <amount>\'`)
      return
    }

    if (!message.member.roles.has(adminRole.id)) {
      message.channel.send(`Vous n'avez pas le rôle attribuez pour utilisez *purge`)
      return
    }

    if(isNaN(amount)) {
      message.channel.send('Pas possible')
      return
    }

    if (amount > 100 && amount > 0) amount = 100;

    const fetched = await message.channel.fetchMessages({limit:parseInt(amount+1)})
    console.log((fetched.size) + ' Message en cours de suppression')

    message.channel.bulkDelete(fetched).catch(error => message.channel.send(`*Erreur ${error}`))

    message.channel.send(`:wastebasket: J'ai supprimé : ${amount} messages pour vous.`)
  }
  purge();
}
client.on('message', message => {
  if(message.content.startsWith("*say")) {
    var text = message.content.split(' ').slice(1).join(' ');
    if(!text) return message.reply("Usage incorrect utilise : *say");
    message.delete().catch(O_o=>{});
    message.channel.send(text);
  }﻿
});


client.on('message', message => {
  if (!message.guild) return;

  if (message.content.startsWith('*kick')) {
    const user = message.mentions.users.first();
    if (user) {
      const member = message.guild.member(user);
      if (member) {
        member.kick('Optional reason that will display in the audit logs').then(() => {
          message.reply(`L'utilisateur ${user.tag} à bien été kick`);
        }).catch(err => {
          message.reply('Je ne peux pas kick cet utilisateur');
          console.error(err);
        });
      } else {
        message.reply('Cet utilisateur n\'est pas sur le discord');
      }
    } else {
      message.reply('Vous n\'avez pas mentionnez la personne à kick.');
    }
  }
});

// Create an event listener for messages
client.on('message', message => {
  // If the message is "ping"
  if (message.content === '*Melkyes') {
    // Send "pong" to the same channel
    message.channel.send('Le plus beau !');
  }
});

// Create an event listener for messages
client.on('message', message => {
  // If the message is "ping"
  if (message.content === '*Mush') {
    // Send "pong" to the same channel
    message.channel.send('Ptdr :joy: il est gros');
  }
});

client.on('message', message => {
    if (message.content === '*avatar') {
      // Remove the "var" line; it isn't necessary.
      let embed = new Discord.RichEmbed()
      // Replace "message.member" with "message.author"
    .setImage(message.author.avatarURL)
    .setColor('#275BF0')
      message.channel.send(embed)
    }
});

client.on('message', message => {
  var args = message.content.toLowerCase().substring(PREFIX.length)
  let adminRole = message.guild.roles.find("id", "548136198695157760" && "518497375728304128" && "544203614269341727" && "452561749720170499" && "459634323415498762" && "548143174816759819") && message.author.names.find("id", "327731712215744514")
  if (args.startsWith("purge")) {
    purgeCommand(message, adminRole, PREFIX, args)
  }
});


client.on('message', (message) => {
  if (message.content.startsWith(PREFIX + "VIP")) {
    let perms = message.member.permissions;
    message.member.addRole('548270072863391774')
  }
});



client.on('message', message => {
  if (message.content === '*help') {
    message.channel.send(helppage)
  }
});


client.login('NTQ5NjU4MDAxMzcyMzQ4NDI1.D1XEbg.jxdfnbNZqXyqJ4XrQ3GBzuEVk04');
