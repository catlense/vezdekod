import 'dotenv/config'
import { API, ButtonColor, Keyboard, Updates, Upload } from 'vk-io'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import User from './models/User.js'
import Meme from './models/Meme.js'
import https from 'https'

const api = new API({
  token: process.env.TOKEN
})

const upload = new Upload({
  api
})

const updates = new Updates({ api, upload })
console.log('Bot started')
mongoose.connect('mongodb://127.0.0.1:27017/vezdekod-bot').then(() => console.log('DB Connected'))

updates.on('message', async (context) => {

  const sendMem = async () => {
    let file
    try {
      file = path.join('images', fs.readdirSync(path.join('images'))[Math.floor(Math.random() * fs.readdirSync(path.join('images')).length - 1)])
    } catch {
      file = path.join('images', fs.readdirSync(path.join('images'))[Math.floor(Math.random() * fs.readdirSync(path.join('images')).length - 1)])
    }
    const user = await User.findOne({ id: context.senderId })
    if (user) {
      if (user.watched.length >= fs.readdirSync(path.join('images')).length) {
        return context.send('Вы посмотрели все доступные мемы :(')
      }
      while (user.watched.includes(path.basename(file))) {
        console.log(file)
        try {
          file = path.join('images', fs.readdirSync(path.join('images'))[Math.floor(Math.random() * fs.readdirSync(path.join('images')).length - 1)])
        } catch {
          file = path.join('images', fs.readdirSync(path.join('images'))[Math.floor(Math.random() * fs.readdirSync(path.join('images')).length - 1)])
        }
      }
    }
    await upload.messagePhoto({
      source: {
        value: file
      }
    }).then((attachment) => {
      const keyboard = Keyboard.keyboard([
        [
          Keyboard.textButton({
            label: '👍',
            payload: {
              command: 'like',
              name: path.basename(file)
            },
            color: ButtonColor.POSITIVE
          }),
          Keyboard.textButton({
            label: '👎',
            payload: {
              command: 'dislike',
              name: path.basename(file)
            },
            color: ButtonColor.NEGATIVE
          })
        ],
        [
          Keyboard.textButton({
            label: 'Статистика',
            color: ButtonColor.SECONDARY
          })
        ],
      ]).oneTime()
      context.send('Лайк или дизлайк?', { attachment, keyboard })
    })
  }


  if (context.text && (context.text.toLocaleLowerCase() === 'привет' || context.text.toLocaleLowerCase() === 'начать')) {
    context.send('Привет вездекодерам!')
    context.send('Баллы - команда (действия):<br><br>10 - Привет<br>20 - вывод после привета<br>30 - мем, статистика, *кнопки клавиатуры*<br>40 - статистика<br>50 - загрузка (с прикрепленным фото)<br><br>Прим.: статистика грузится, просто её нужно немного подождать:)')
    const keyboard = Keyboard.keyboard([
      [
        Keyboard.textButton({
          label: 'Нормально',
          payload: {
            command: 'first_quest',
            value: 'norm'
          },
          color: Keyboard.POSITIVE_COLOR
        }),
        Keyboard.textButton({
          label: 'Не очень',
          payload: {
            command: 'first_quest',
            value: 'takoe'
          },
          color: Keyboard.NEGATIVE_COLOR
        }),
      ],
      Keyboard.textButton({
        label: 'Следующий вопрос',
        payload: {
          command: 'first_quest',
          value: 'skip'
        },
        color: Keyboard.SECONDARY_COLOR
      })
    ]).oneTime()
    context.send('1. Как ты?', { keyboard })
  } else if (context.text && context.text.toLowerCase() === 'мем') {
    await sendMem()
  } else if (context.messagePayload && context.text === '👍' || context.text === '👎') {
    const user = await User.findOne({ id: context.senderId })
    if (user) {
      if (context.messagePayload.command === 'like') {
        user.likes = user.likes + 1
        user.watched.push(context.messagePayload.name)
        user.memes.push({ name: context.messagePayload.name, type: 'like' })
      } else {
        user.dislikes = user.dislikes + 1
        user.watched.push(context.messagePayload.name)
        user.memes.push({ name: context.messagePayload.name, type: 'dislike' })
      }
      await user.save()
    } else if (!user && context.messagePayload.command === 'like') {
      const [user] = await api.users.get({ user_ids: context.senderId })
      const newUser = new User({
        id: context.senderId,
        name: user.first_name,
        surname: user.last_name,
        likes: 1,
        dislikes: 0,
        watched: [context.messagePayload.name],
        memes: [{ name: context.messagePayload.name, type: 'like' }]
      })
      await newUser.save()
    } else if (!user && context.messagePayload.command === 'dislike') {
      const [user] = await api.users.get({ user_ids: context.senderId })
      const newUser = new User({
        id: context.senderId,
        name: user.first_name,
        surname: user.last_name,
        likes: 0,
        dislikes: 1,
        watched: [context.messagePayload.name],
        memes: [{ name: context.messagePayload.name, type: 'dislike' }]
      })
      await newUser.save()
    }
    const mem = await Meme.findOne({ file: context.messagePayload.name })
    if (mem) {
      if (context.messagePayload.command === 'like') {
        mem.likes = mem.likes + 1
      } else {
        mem.dislikes = mem.dislikes + 1
      }
      await mem.save()
    }
    if (!mem && context.messagePayload.command === 'like') {
      const newMem = new Meme({
        id: await Meme.count(),
        file: context.messagePayload.name,
        likes: 1,
        dislikes: 0
      })
      await newMem.save()
    } else if (!mem && context.messagePayload.command === 'dislike') {
      const newMem = new Meme({
        id: await Meme.count(),
        file: context.messagePayload.name,
        likes: 0,
        dislikes: 1
      })
      await newMem.save()
    }
    await sendMem()
  } else if (context.text && context.text.toLocaleLowerCase() === 'статистика') {
    const users = await User.find({}, { _id: 0, watched: 0, memes: 0, __v: 0 })
    let result = ''
    users.forEach(async (e, i) => {
      result += `${i + 1}. ${e.name} ${e.surname}: лайков: ${e.likes}; дизлайков: ${e.dislikes}<br>`
    })
    result += '<br><br>Самые залайканные мемы:'
    let memes = await Meme.find({}, { _id: 0, __v: 0 })
    memes.sort((a, b) => { return b.likes - a.likes })
    const attachment = []

    Promise.all(memes.map(async(e) => {
      await upload.messagePhoto({
        source: {
          value: path.join('images', e.file)
        }
      }).then(a => {if(attachment.length === 9) return; attachment.push(`photo${a.ownerId}_${a.id}`);})
    })).then(() => {
      context.send(result, {
        attachment,
        keyboard: Keyboard.keyboard([
          [Keyboard.textButton({ label: 'Мем', color: ButtonColor.PRIMARY })],
          [Keyboard.textButton({ label: 'Статистика', color: ButtonColor.SECONDARY })]
        ])
      })
    })
  } else if(context.text && context.text.toLowerCase() === 'загрузить') {
    if(context.attachments && context.attachments[0]) {
      let file = fs.createWriteStream(path.join('images', path.basename(context.attachments[0].largeSizeUrl).split('?')[0]))
      https.get(context.attachments[0].largeSizeUrl, function(response) {
        response.pipe(file);
      });
      console.log(path.basename(context.attachments[0].largeSizeUrl).split('?')[0])
      context.reply('Мем добавлен в коллекцию!')
    } else {
      context.reply('Прикрепите фотографию')
    }
  } else {
    if (context.messagePayload && context.messagePayload.command === 'first_quest') {
      context.send(`${context.messagePayload.value === 'skip' ?
        'Пропускаешь? Ну ладно..(' : context.messagePayload.value === 'norm' ?
          'Рад, что у тебя всё хорошо, значит, продолжаем!' : 'Плохо, что не очень, но давай продолжим...'}`)
      const keyboard = Keyboard.keyboard([
        [
          Keyboard.textButton({
            label: 'Россия',
            payload: {
              command: 'second_quest',
              value: 'ru'
            },
            color: Keyboard.PRIMARY_COLOR
          }),
          Keyboard.textButton({
            label: 'Казахстан',
            payload: {
              command: 'second_quest',
              value: 'kz'
            },
            color: Keyboard.PRIMARY_COLOR
          }),
        ],
        Keyboard.textButton({
          label: 'Другое',
          payload: {
            command: 'second_quest',
            value: 'other'
          },
          color: Keyboard.SECONDARY_COLOR
        })
      ]).inline()
      context.send('2. Где ты живёшь?', { keyboard })
    } else if (context.messagePayload && context.messagePayload.command === 'second_quest') {
      context.send(`${context.messagePayload.value === 'ru' ?
        'Мы с тобой так похожи, может, это судьба?' : context.messagePayload.value === 'kz' ?
          'Соседям ку, остальным соболезную' : 'ыаыа??'}`)
      const keyboard = Keyboard.keyboard([
        [
          Keyboard.urlButton({
            label: 'Конечно хочу!',
            url: 'https://catlense.ru',
          }),
        ],
        [
          Keyboard.textButton({
            label: 'Я перешёл',
            payload: {
              command: 'third_quest',
              value: 'yes'
            },
            color: Keyboard.POSITIVE_COLOR
          })
        ],
        [
          Keyboard.textButton({
            label: 'Не хочу',
            payload: {
              command: 'third_quest',
              value: 'no'
            },
            color: Keyboard.NEGATIVE_COLOR
          })
        ],
      ])
      context.send('3. Хочешь ли ты перейти на мой сайт?', { keyboard })

    } else if (context.messagePayload && context.messagePayload.command === 'third_quest') {
      context.send(`${context.messagePayload.value === 'yes' ?
        'Спасибо, мне очень приятно!' : 'Блин, ну ладно('}`)
      const keyboard = Keyboard.keyboard([
        [
          Keyboard.locationRequestButton({
            payload: {
              command: 'fourth_quest',
              value: 'ok'
            }
          }),
        ],
        [
          Keyboard.textButton({
            label: 'Пропустить',
            payload: {
              command: 'fourth_quest',
              value: 'skip'
            }
          })
        ]
      ]).oneTime()
      context.send('4. Можешь ли ты поделиться своим местоположением?', { keyboard })
    } else if (context.messagePayload && context.messagePayload.command === 'fourth_quest') {
      context.send(`${context.messagePayload.value === 'ok' ?
        'Жди в гости <3' : 'Звук по-анонимовски'}`)
      const keyboard = Keyboard.keyboard([
        [
          Keyboard.payButton({
            hash: {
              action: 'transfer-to-group',
              group_id: 207846662,
              aid: 10
            },
            payload: {
              command: 'fifth_quest',
              value: 'pay'
            }
          }),
        ],
        [
          Keyboard.textButton({
            label: 'В курсе!',
            payload: {
              command: 'fifth_quest',
              value: 'skip'
            },
            color: ButtonColor.POSITIVE
          })
        ]
      ]).oneTime()
      context.send('5. Ты вообще в курсе, что есть вариант оплатить с помощью VK Pay?', { keyboard })
    } else if (context.messagePayload && context.messagePayload.command === 'fifth_quest') {
      context.send(`${context.messagePayload.value === 'pay' ?
        'Уаааау' : 'Отлично!'}`)
      const keyboard = Keyboard.keyboard([
        [
          Keyboard.textButton({
            label: '8',
            payload: {
              command: 'sixth_quest',
              value: '8'
            },
            color: ButtonColor.POSITIVE
          }),
          Keyboard.textButton({
            label: '6',
            payload: {
              command: 'sixth_quest',
              value: '6'
            },
            color: ButtonColor.NEGATIVE
          }),
          Keyboard.textButton({
            label: '1010101',
            payload: {
              command: 'sixth_quest',
              value: '1010101'
            },
            color: ButtonColor.NEGATIVE
          }),
        ],
        [
          Keyboard.textButton({
            label: '10',
            payload: {
              command: 'sixth_quest',
              value: '10'
            },
          })
        ],
        [
          Keyboard.textButton({
            label: '12',
            payload: {
              command: 'sixth_quest',
              value: '12'
            },
          }),
          Keyboard.textButton({
            label: '14',
            payload: {
              command: 'sixth_quest',
              value: '14'
            },
          }),
        ]
      ]).inline()
      context.send('6. Кстати, а сколько будет 2 + 2 * 2?', { keyboard })
    } else if (context.messagePayload && context.messagePayload.command === 'sixth_quest') {
      context.send(`${context.messagePayload.value === '6' ?
        'Да ты прям гений математики!' : 'wow'}`)

      const keyboard = Keyboard.keyboard([
        [
          Keyboard.textButton({
            label: 'Хорооош',
            payload: {
              command: 'seventh_quest',
              value: 'norm'
            },
            color: ButtonColor.POSITIVE
          }),
          Keyboard.textButton({
            label: 'Мегахорош',
            payload: {
              command: 'seventh_quest',
              value: 'meganorm'
            },
            color: ButtonColor.POSITIVE
          })
        ],
        [
          Keyboard.textButton({
            label: 'Пойдёт',
            payload: {
              command: 'seventh_quest',
              value: 'takoe'
            }
          })
        ],
        [
          Keyboard.textButton({
            label: 'Не оч',
            payload: {
              command: 'seventh_quest',
              value: 'bad'
            },
            color: ButtonColor.NEGATIVE
          }),
          Keyboard.textButton({
            label: 'Оч не оч',
            payload: {
              command: 'seventh_quest',
              value: 'sobad'
            },
            color: ButtonColor.NEGATIVE
          })
        ]
      ]).oneTime()
      context.send('7. Кстати, как тебе tpoksy?', { keyboard })
    } else if (context.messagePayload && context.messagePayload.command === 'seventh_quest') {
      context.send(`${context.messagePayload.value === 'norm' || 'meganorm' ?
        'Спасибо за оценку!' : 'Блинб, ладно((('}`)

      const keyboard = Keyboard.keyboard([
        [
          Keyboard.applicationButton({
            label: 'Чатботы',
            appId: 6013442,
            ownerId: -197700721,
          })
        ],
        [
          Keyboard.textButton({
            label: 'Открыли!',
            payload: {
              command: 'eighth_quest',
              value: 'true'
            },
            color: ButtonColor.POSITIVE
          })
        ]
      ]).oneTime()

      context.send('8. Давай откроем приложение?', { keyboard })
    } else if (context.messagePayload && context.messagePayload.command === 'eighth_quest') {
      context.send(`${context.messagePayload.value === 'true' &&
        'Надеюсь на максимальный балл)'}`)
    }
  }
})

updates.start()