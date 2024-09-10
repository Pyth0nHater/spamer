// addSession.js
const { TelegramClient, Logger } = require("telegram");
const { StringSession } = require("telegram/sessions");
const API_ID = 25171031;
const API_HASH = "10f7696a65a7217fad43302ea6ba1695";
const Account = require('../models/Account'); 

const addSession = async (bot, chatId, db) => {
    bot.sendMessage(chatId, "Запуск процесса добавления новой учетной записи...");

    const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
        baseLogger: new Logger('warn'),
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => {
            bot.sendMessage(chatId, "Введите ваш номер телефона:");
            return new Promise((resolve) => {
                bot.once('message', (msg) => resolve(msg.text));
            });
        },
        password: async () => {
            bot.sendMessage(chatId, "Введите ваш пароль:");
            return new Promise((resolve) => {
                bot.once('message', (msg) => resolve(msg.text));
            });
        },
        phoneCode: async () => {
            let code = "";
            let sentMessage;

            const updateMessage = async () => {
                if (sentMessage) {
                    await bot.editMessageText(`Текущий код: ${code || '(пусто)'}`, {
                        chat_id: chatId,
                        message_id: sentMessage.message_id,
                        reply_markup: {
                            inline_keyboard: [
                                ['1', '2', '3'].map((num) => ({ text: num, callback_data: num })),
                                ['4', '5', '6'].map((num) => ({ text: num, callback_data: num })),
                                ['7', '8', '9'].map((num) => ({ text: num, callback_data: num })),
                                [{ text: '0', callback_data: '0' }, { text: 'Удалить', callback_data: 'delete' }]
                            ]
                        }
                    });
                } else {
                    sentMessage = await bot.sendMessage(chatId, `Текущий код: ${code || '(пусто)'}`, {
                        reply_markup: {
                            inline_keyboard: [
                                ['1', '2', '3'].map((num) => ({ text: num, callback_data: num })),
                                ['4', '5', '6'].map((num) => ({ text: num, callback_data: num })),
                                ['7', '8', '9'].map((num) => ({ text: num, callback_data: num })),
                                [{ text: '0', callback_data: '0' }, { text: 'Удалить', callback_data: 'delete' }]
                            ]
                        }
                    });
                }
            };

            await updateMessage();

            return new Promise((resolve) => {
                bot.on('callback_query', async (query) => {
                    const data = query.data;

                    if (data === 'delete') {
                        code = code.slice(0, -1);
                    } else {
                        code += data;
                    }

                    await updateMessage();

                    if (code.length === 5) {
                        resolve(code);
                    }

                    bot.answerCallbackQuery(query.id);
                });
            });
        },
        onError: (err) => console.error(err),
    });

    const sessionString = client.session.save();

    // Запросить имя учетной записи
    bot.sendMessage(chatId, "Успешный вход\nВведите имя для этой учетной записи:");
    const accountName = await new Promise((resolve) => {
        bot.once('message', (msg) => resolve(msg.text));
    });

    // Записываем в MongoDB через модель Mongoose
    try {
        await Account.create({
            name: accountName,
            session: sessionString,
            chatId: chatId,
        });
        bot.sendMessage(chatId, 'Новая сессия добавлена.');
    } catch (error) {
        console.error('Ошибка при записи в MongoDB:', error);
        bot.sendMessage(chatId, 'Произошла ошибка при сохранении сессии.');
    }
};

module.exports = { addSession };
