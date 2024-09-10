const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const Account = require('./src/models/Account'); // Подключаем модель Account
const { addSession } = require('./src/services/addSession');
const { sendMessagesInBatches } = require('./src/services/sendMessages');

const API_ID = 25171031;
const API_HASH = "10f7696a65a7217fad43302ea6ba1695";
const BOT_TOKEN = "6367374872:AAHdjQNVzrC-WyVp-_4sQDDU8PQ7mpvkoA8";

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
                    [{ text: 'Мои конфигурации', callback_data: 'MyConfigs' }],
                    [{ text: 'Начать рассылку', callback_data: 'SendMessages' }]
                ]
            }
        });
    });

    // Обработка callback_query
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        if (data === 'AddAccount') {
            await addSession(bot, chatId, mongoose); // передача mongoose
        } else if (data === 'MyAccounts') {
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
        } else if (data === 'SendMessages') {
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
