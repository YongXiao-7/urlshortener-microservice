"use strict";
require("dotenv").config({
  path: "./sample.env",
});
const express = require("express");
//const mongo = require("mongodb");
const mongoose = require("mongoose");
mongoose.Promise = require("bluebird");
// 不要忘记使用body parsing 中间件来处理POST请求。
const bodyParser = require("body-parser");
// 使用dns核心模块中的dns.lookup(host,cb)函数验证提交的URL
const dns = require("dns");
const cors = require("cors");
const { reject } = require("bluebird");
const app = express();
const router = express.Router();
// 添加路由到app上
app.use("/api", router);
// 基本配置
const port = process.env.PORT || 3000;
// 在Express框架中,直接使用cors可以解决跨域问题。
app.use(cors());
/**
 * mongoose.connect(process.env.MONGOLAB_URI,{
    useMongoClient : true
});
 */
// 连接数据库
mongoose.connect(process.env.MONGOLAB_URI);
const urlMappingSchema = new mongoose.Schema({
  original_url: String,
  short_url: Number,
});
const UrlMapping = mongoose.model("UrlMapping", urlMappingSchema);
router.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use("/public", express.static(`${process.cwd()}/public`));
console.log(process.cwd() + "/views/index.html");
app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});
// 你的第一个API端点
// 用router.get()访问的路径在浏览器中要加/api
router.get("/hello", function (req, res) {
  res.json({
    greeting: "hello API",
  });
});
router.post("/shorturl/", (req, res) => {
  const url = req.body.url;
  const dnsLookup = new Promise((resolve, reject) => {
    if (isUrl(url)) {
      let result = url.replace(/(^\w+:|^)\/\//, "");
      let string = result.substring(0, result.indexOf("/"));
      if (string) {
        result = string;
      }
      dns.lookup(result, (err, address, family) => {
        if (err) reject("invalid hostname");
        resolve(address);
      });
    } else {
      reject("invalid URL");
    }
  });
  dnsLookup
    .then(() => {
      // 检查url是否存在
      return checkIfExist(url);
    })
    .then((data) => {
      if (data.status) {
        return res.json({
          original_url: url,
          short_url: data.short_url,
        });
      } else {
        const shortUrl = shorterUrl();
        const urlMapping = new UrlMapping({
          original_url: url,
          short_url: shortUrl,
        });
        /**
         * 拿到返回的promise数据，必须用prmose.then()方法。
         */
        let promise = saveUrlMapping(urlMapping);
        promise
          .then((data) => {
            return res.json({
              original_url: data.original_url,
              short_url: data.short_url,
            });
          })
          .catch((err) => {
            return res.json({
              error: err,
            });
          });
        /**
             * [UnhandledPromiseRejection: This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). The promise rejected with the reason "invalid URL".] {
  code: 'ERR_UNHANDLED_REJECTION'
  解决方法: promise.then().catch()
             */
        // promise.catch((err) => {
        //     return res.json({
        //         error : err
        //     });
        // });
      }
    })
    .catch((err) => {
      return res.json({
        error: err,
      });
    });
  //   dnsLookup.catch((err) => {
  //      return res.json({
  //         error : err
  //      });
  //   });
});
// 在浏览器访问的时候形参shortUrl前面不加:
router.get("/shorturl/:shortUrl", (req, res) => {
  let redirectPromise = redirectToOriginalUrl(req.params.shortUrl);
  redirectPromise.then((original_url) => {
    return res.redirect(original_url);
  });
  redirectPromise.catch((reason) => {
    return res.json({
      error: reason,
    });
  });
});
function redirectToOriginalUrl(short_url) {
  return new Promise((resolve, reject) => {
    // UrlMapping.findOne({
    //     short_url : short_url
    // },(err,doc) => {
    //     if(err || doc === null) return reject(err);
    //     else return resolve(doc.original_url);
    // });
    UrlMapping.findOne({
      short_url: short_url,
    })
      .then((doc) => {
        if (doc === null) {
          return reject("invalid URL");
        } else {
          return resolve(doc.original_url);
        }
      })
      .catch((err) => {
        return reject("invalid URL");
      });
  });
}
function checkIfExist(original_url) {
  return new Promise((resolve, reject) => {
    // UrlMapping.deleteMany({})
    //           .then((data) => {
    //             console.log('删除数据成功');
    //           })
    //           .catch((err) => {
    //             console.err('删除数据失败');
    //           })
    UrlMapping.findOne({
      original_url: original_url,
    })
      .then((doc) => {
        if (doc === null) {
          resolve({
            status: false,
          });
        } else {
          resolve({
            status: true,
            short_url: doc.short_url,
          });
        }
      })
      .catch((err) => {
        reject({
          status: false,
        });
      });
    // UrlMapping.findOne({ original_url: original_url }, function(err, doc) {
    //     if (doc === null || err) resolve({ status: false });
    //     else resolve({ status: true, short_url: doc.short_url });
    //   });
    // UrlMapping.findOne({
    //     original_url : original_url
    // },(err,doc) => {
    //     if(doc === null || err){
    //         resolve({
    //         status : false
    //     })}else{
    //         resolve({
    //             status : true,
    //             short_url : doc.short_url
    //         });
    //     };
    // });
  });
}
/**
 * MongooseError: Model.findOne() no longer accepts a callback at Function.findOne
 * 这个错误信息表示 Model.findOne() 方法不再接受回调函数作为参数，所以我们需要修改代码以适应最新的版本。
 * 为了解决这个问题，我们需要将原来的回调函数的写法转换为 Promise 的写法。下面是修改后的示例代码：
 * const User = require('./models/user');

// 使用回调函数
User.findOne({ name: 'John' }, (err, user) => {
  if (err) {
    console.error(err);
  } else {
    console.log(user);
  }
});

// 使用 Promise
User.findOne({ name: 'John' })
  .then(user => {
    console.log(user);
  })
  .catch(err => {
    console.error(err);
  });
在上面的示例中，我们首先导入了 User 模型，然后使用 findOne() 方法查询名为 ‘John’ 的用户。在原来的写法中，我们使用回调函数来处理返回的结果。

为了解决这个问题，我们将回调函数的写法转换为 Promise 的写法。通过调用 findOne() 方法后返回的 Promise 对象，我们可以使用 then() 方法处理成功的回调，使用 catch() 方法处理错误的回调。

这样修改后的代码可以适应 MongoDB Mongoose 的最新版本，并且不会再出现 Model.findOne() 不再接受回调函数的错误。
 */
// function checkIfExist(original_url) {
//     return new Promise(function(resolve, reject) {
//       UrlMapping.findOne({ original_url: original_url }, function(err, doc) {
//         if (doc === null || err) resolve({ status: false });
//         else resolve({ status: true, short_url: doc.short_url });
//       });
//     });
//   }
function saveUrlMapping(mapping) {
  //let v = new Promise((resolve,reject) => {
  // mapping.save((err,data) => {
  //     if(err) return reject(err);
  //     else return resolve(null,data);
  // });
  // UrlMapping(mapping)
  //         .save()
  //            .then((data) => {
  //               resolve(data);
  //            }).catch((err) =>{
  //               reject(err);
  //            });

  //});
  return new Promise((resolve, reject) => {
    mapping
      .save()
      .then((data) => {
        resolve(data);
      })
      .catch((err) => {
        reject(err);
      });
  });
  //    return promise.then((doc) => {
  //         return doc;
  //     })
  //     .catch((err) => {
  //         return err;
  //     });
}
function shorterUrl() {
  let text = 0;
 // const possible =
   // "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   let possible = "0123456789"
  for (var i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
function isUrl(url) {
  //let regexp = new RegExp("[a-zA-z]+://[^\s]*");
  let regexp = new RegExp("^((https|http|ftp|rtsp|mms)?://)[^s]+");
  return regexp.test(url);
}
app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
/**
 * 运行scripts(package.json) npm run start或npm run dev
 * 如果命令找不到,就看命令是否安装npm install -g 或 看系统的环境变量PATH
 * 是否有相应命令的所在目录
 * nodemon是一种工具，通过在检测到目录中的文件更改时自动重新启动node应用程序来帮助开发基于
 * node.js的应用程序。一般只在开发时使用，用nodemon代替node来运行代码，这样当代码发生改变时，
 * 进程会自动重启。npm add -g nodemon
 * npm的全程是Node Package Manager,是一个NodeJS包管理和分发工具，已经成为了非官方的发布Node
 * 模块(包)的标准。
 * 2020 年 3 月 17 日，Github 宣布收购 npm，GitHub 现在已经保证 npm 将永远免费。
node.js 是 javascript 的一种运行环境，是对 Google V8 引擎进行的封装。是一个服务器端的 javascript 的解释器。

安装node.js会自带 npm，同时提供 npx 命令，使用 npx 命令可以直接调用模块命令。
 */
/**
 * Error: Cannot find module 'bluebird'
 * 解决方法
 * npm install bluebird --save
 * MongoDB 连接报错 Authentication failed
 * 解决方法
 * 当retryWrites设置为true时,表示在写操作发生网络错误时自动重试;当retryWrites设置为false时,则不会自动重试,需要手动处理网络错误
 * {w: “majority”}
写到多数节点
使用这个写安全级别，MongoDB只有在数据已经被复制到多数个节点的情况下才会向客户端返回确认
 * uri = mongodb+srv://{processs.env.DB_USER}:${process.env.DB_PASS}@cluster0.az3oh.mongodb.net/myFirstDatabase?retryWrites=true&w=majority
 */
