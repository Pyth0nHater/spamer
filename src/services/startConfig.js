const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const Config = require('../models/Config'); 
const Account = require('../models/Account'); 

require('dotenv').config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


const startConfig =  async (bot, chatId, API_ID, API_HASH) =>{

    try {
        const configs = await Config.find({ chatId: chatId });
    
    if (configs.length > 0) {
        await bot.sendMessage(chatId, 'Выберите сессию:', {
            reply_markup: {
                inline_keyboard: configs.map(configs => [
                    {
                        text: configs.configName.toString(),
                        callback_data: configs._id
                    }
                ])
            }
        });
        bot.on('callback_query', async (callbackQuery) => {
            const sessionId = callbackQuery.data;
            const config = await Config.findOne({ _id: sessionId });

            let usernames = config.chats
            let batchSize = config.bathSize
            let waitTime = config.delay
            let messageText = config.message
            let ownerSession = config.session
            let accountName = config.sessionName
        
            const sendMessages = async () => {
                const client = new TelegramClient(new StringSession(ownerSession), API_ID, API_HASH);
                await client.start();
        
                await bot.sendMessage(chatId, `Имя аккаунта: ${accountName}\nЧаты:${usernames.slice(9).join(', ')} и еще ${usernames.length - 10}\nРазмер партии: ${batchSize}\nЗадержка: ${waitTime / 1000} секунд\nТекст сообщения:\n${messageText}`);
        
                for (let i = 0; i < usernames.length; i += batchSize) {
                    const batch = usernames.slice(i, i + batchSize);
                    for (const username of batch) {
                        try {
                            const entity = await client.getEntity(username);
                            // await sleep(1000);
                            await client.invoke(
                                new Api.messages.SendMessage({
                                    peer: entity,
                                    message: messageText,
                                    randomId: BigInt(-Math.floor(Math.random() * 1e12)),
                                    noWebpage: true,
                                    noforwards: true,
                                })
                            );
                            console.log(`Сообщение отправлено: ${username}`);
                        } catch (error) {
                            if (error.errorMessage === 'FLOOD') {
                                console.error(`Не удалось отправить сообщение ${username}: Включен режим медленной отправки. Подождите ${error.seconds} секунд.`);
                            } else {
                                console.error(`Не удалось отправить сообщение ${username}:`, error);
                            }
                        }
                    }
                    if (i + batchSize < usernames.length) {
                        console.log(`Ожидание ${waitTime / 1000} секунд перед следующей партией...`);
                        await sleep(waitTime);
                    }
                }
        
                await bot.sendMessage(chatId, "Все сообщения отправлены");
            };

            sendMessages()
        
        });
    } else {
        await bot.sendMessage(chatId, 'У вас нет доступных сессий.');
    }
    } catch (error) {
        console.error('Ошибка при получении аккаунтов:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при получении аккаунтов.');
    }



}

module.exports = { startConfig }