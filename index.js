const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const Account = require('./src/models/Account'); 
const Config = require('./src/models/Config'); 
const { addSession } = require('./src/services/addSession');
const { addConfig } = require('./src/services/addConfig');
const { sendMessagesInBatches } = require('./src/services/sendMessages');
require('dotenv').config();

const API_ID = process.env.API_ID
const API_HASH = process.env.API_HASH
const BOT_TOKEN = process.env.BOT_TOKEN

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/telegram_bot').then(() => {
    console.log('MongoDB подключена');

    // Обработка команды /start
    bot.onText(/\/start/, async (msg) => {
        await bot.sendMessage(msg.chat.id, `Выберете дейстивие:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Мои аккаунты', callback_data: 'MyAccounts' }, { text: 'Добавить аккаунт', callback_data: 'AddAccount' }],
                    [{ text: 'Мои конфигурации', callback_data: 'MyConfigs' }, { text: 'Добавить конфигурацию', callback_data: 'addConfig' }],
                    [{ text: 'Запустить конфигурацию', callback_data: 'SendMessages' }],
                    [{ text: 'Запустить рассылку', callback_data: 'SendMess' }]
                ]
            }
        });
    });

    // Обработка callback_query
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        if (data === 'AddAccount') {
            await addSession(API_ID, API_HASH, bot, chatId);
        }
        else if (data === 'addConfig'){
            await addConfig(bot, chatId)
        }
        else if (data === 'MyAccounts') {
            // Получаем аккаунты для текущего chatId
            try {
                const sessions = await Account.find({ chatId: chatId });
            
            if (sessions.length > 0) {
                await bot.sendMessage(chatId, 'Выберите сессию:', {
                    reply_markup: {
                        inline_keyboard: sessions.map(session => [
                            {
                                text: session.name,
                                callback_data: session._id
                            }
                        ])
                    }
                });
            } else {
                await bot.sendMessage(chatId, 'У вас нет доступных сессий.');
            }
            } catch (error) {
                console.error('Ошибка при получении аккаунтов:', error);
                await bot.sendMessage(chatId, 'Произошла ошибка при получении аккаунтов.');
            }
        
        } else if ((data === 'MyConfigs')){
            try {
                const configs = await Config.find({ chatId: chatId });
            
            if (configs.length > 0) {
                await bot.sendMessage(chatId, 'Выберите сессию:', {
                    reply_markup: {
                        inline_keyboard: configs.map(configs => [
                            {
                                text: configs.configName,
                                callback_data: configs._id
                            }
                        ])
                    }
                });
                bot.on('callback_query', async (callbackQuery) => {
                    const sessionId = callbackQuery.data;
                    const config = await Config.findOne({ _id: sessionId });

                    await bot.sendMessage(chatId, `Имя аккаунта: ${config.sessionName}\nЧаты:${config.chats.join(', ')}\nРазмер партии: ${config.bathSize}\nЗадержка: ${config.delay} мс\nТекст сообщения:\n${config.message}`);
        
                });
            } else {
                await bot.sendMessage(chatId, 'У вас нет доступных сессий.');
            }
            } catch (error) {
                console.error('Ошибка при получении аккаунтов:', error);
                await bot.sendMessage(chatId, 'Произошла ошибка при получении аккаунтов.');
            }
        }  else if (data === 'SendMessages') {
            // Запускаем процесс отправки сообщений
            await sendMessagesInBatches(bot, chatId, API_ID, API_HASH);

        } else if (data === 'closeMenu') {
            await bot.sendMessage(chatId, 'Меню закрыто.');
        }
    });

    // Обработка ошибок опроса
    bot.on('polling_error', (error) => {
        console.log(`Ошибка опроса: ${error.code} - ${error.message}`);
    });
}).catch(err => {
    console.error('Ошибка подключения к MongoDB:', err);
});
