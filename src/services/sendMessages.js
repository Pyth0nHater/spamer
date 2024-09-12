const fs = require('fs');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const Account = require('../models/Account'); 

const sendMessagesInBatches = async (bot, chatId, API_ID, API_HASH) => {
    let usernames = [];
    let batchSize;
    let waitTime;
    let messageText;
    let currentStepMessage;
    let ownerSession;
    let accountName;

    const updateMessage = async (text) => {
        if (currentStepMessage) {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: currentStepMessage.message_id,
            });
        } else {
            currentStepMessage = await bot.sendMessage(chatId, text);
        }
    };

    const handleMessage = (callback) => new Promise((resolve) => {
        const handler = async (msg) => {
            if (callback(msg)) {
                bot.removeListener('message', handler);
                resolve();
            }
        };
        bot.on('message', handler);
    });

    const step0 = async () => {
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
        } catch (err) {
            console.error('Ошибка получения сессий из базы данных:', err);
        }

        bot.on('callback_query', async (callbackQuery) => {
            const sessionId = callbackQuery.data;
            const account = await Account.findOne({ _id: sessionId });
            ownerSession = account.session;
            accountName = account.name;
            step1();
        });
    };

    const step1 = async () => {
        await bot.sendMessage(chatId, "Пожалуйста, загрузите файл .txt с ссылками на чаты (каждый чат на новой строке):");
        
        await handleMessage(async (msg) => {
            if (msg.document) {
                const fileId = msg.document.file_id;
                const filePath = await bot.downloadFile(fileId, './');

                try {
                    const fileData = fs.readFileSync(filePath, 'utf-8');
                    usernames = fileData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                    await updateMessage(`Найдено ${usernames.length} чатов.`);
                    return true; // Stop listening
                } catch (error) {
                    console.error('Ошибка при чтении файла:', error);
                    await updateMessage("Ошибка при чтении файла. Попробуйте снова загрузить файл.");
                }
            } else {
                await updateMessage("Пожалуйста, загрузите файл в формате .txt.");
            }
            return false;
        });
        step2();
    };

    const step2 = async () => {
        await bot.sendMessage(chatId, "Введите размер партии (рекомендуемо: 6)");
        
        await handleMessage(async (msg) => {
            const size = parseInt(msg.text, 10);
            if (!isNaN(size)) {
                batchSize = size;
                return true;
            } else {
                await updateMessage("Пожалуйста, введите корректное число для размера партии:");
            }
            return false;
        });
        step3();
    };

    const step3 = async () => {
        await bot.sendMessage(chatId, "Введите время задержки секунд между партиями (рекомендуемо: 900)");

        await handleMessage(async (msg) => {
            const time = parseInt(msg.text, 10);
            if (!isNaN(time)) {
                waitTime = time * 1000;
                return true;
            } else {
                await updateMessage("Пожалуйста, введите корректное число для времени задержки:");
            }
            return false;
        });
        step4();
    };

    const step4 = async () => {
        await bot.sendMessage(chatId, "Введите сообщение для рассылки:");

        await handleMessage(async (msg) => {
            messageText = msg.text;
            if (messageText) {
                return true;
            } else {
                await updateMessage("Пожалуйста, введите сообщение:");
            }
            return false;
        });
        sendMessages();
    };

    const sendMessages = async () => {
        const client = new TelegramClient(new StringSession(ownerSession), API_ID, API_HASH);
        await client.start();

        await bot.sendMessage(chatId, `Имя аккаунта: ${accountName}\nЧаты:${usernames.slice(9).join(', ')} и еще ${usernames.length - 10}\nРазмер партии: ${batchSize}\nЗадержка: ${waitTime / 1000} секунд\nТекст сообщения:\n${messageText}`);

        for (let i = 0; i < usernames.length; i += batchSize) {
            const batch = usernames.slice(i, i + batchSize);
            for (const username of batch) {
                try {
                    const entity = await client.getEntity(username);
                    await sleep(1000);
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

    // Запуск процесса с первого шага (выбора сессии)
    await step0();
};

module.exports = { sendMessagesInBatches };
