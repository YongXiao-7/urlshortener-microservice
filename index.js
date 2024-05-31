"use strict";
require("dotenv").config({
  path: "./.env",
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
const { lstat } = require("fs");
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
//const short_url_total_init= process.env.SHORT_URL_TOTAL;
const urlMappingSchema = new mongoose.Schema({
  original_url: {
    type : String,
    unique : true
  },
  short_url: {
    type : Number,
    unique : true
  }
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
router.post("/shorturl", (req, res) => {
 const url = req.body.url;
  const dnsLookup = new Promise((resolve, reject) => {
 // const url = req.body.url;
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
        shortUrl.then(shortUrl => {
            const urlMapping = new UrlMapping({
            original_url: url,
            short_url: shortUrl,
         });
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
        }).catch(err => {
          console.log(err);
          return res.json({
            error : err
          });
        });
     }});
   dnsLookup.catch((err) => {
     console.log(err);
    return res.json({
       error : err
     });
   });
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
    //  UrlMapping.deleteMany({})
    //       .then((data) => {
    //          console.log('删除数据成功');
    //      })
    //     .catch((err) => {
    //      console.err('删除数据失败');
    //   });
    UrlMapping.findOne({
      original_url: original_url,
    })
      .then((doc) => {
        if (doc === null) {
;          resolve({
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
}

function shorterUrl() {
  let num = 0;
 // let text = 0;
 // const possible =
   // "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   //let possible = "0123456789"
 // for (var i = 0; i < 5; i++) {
    //text += possible.charAt(Math.floor(Math.random() * possible.length));
  //}
//  return text；s
return new Promise((resolve,reject) =>  {
  const lastRecord = UrlMapping.findOne().sort({ _id: -1 }).exec();
    lastRecord.then(lastRecord => {
      if(lastRecord !== null){
        resolve(++lastRecord.short_url);
      }else{
        resolve(++num);
      }
    });
    lastRecord.catch(err => {
        console.log(err);
        reject(err);
    });
})
}
function isUrl(url) {
  //let regexp = new RegExp("[a-zA-z]+://[^\s]*");
  let regexp = new RegExp("^((https|http|ftp|rtsp|mms)?://)[^s]+");
  return regexp.test(url);
}
app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
