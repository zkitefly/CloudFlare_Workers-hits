# CloudFlare_Workers-hits

使用 CloudFlare Workers 的 hits 标签。

## 部署

1.拷贝 [workers.js](/workers.js) 的所有完整代码；

2.打开 [dash.cloudflare.com](https://dash.cloudflare.com/)，进入 `Workers 和 Pages` 页面，点击`创建`；

3.点击 `Hello world` 跳过模板设置；

4.设置名称，并点击 `部署`；

5.点击 `编辑代码`，将第一步拷贝的代码覆盖进去，点击 `部署`；

6.返回并进入设置，在 绑定 处添加 `D1 数据库` 绑定，变量名设置 `DB`，然后再选择数据库（如果没有则在 `存储和数据库` - `D1 SQL 数据库` 创建），并点击 `部署`。

7.完成！

## 使用

需要在页面中访问：

```
{你的 Worker 地址}?tag={你的标签}
```

成功则会返回一个 svg 图片，显示访问次数。

```
{该标签访问总次数} / {该标签当天（UTC+8）访问次数}
```

## 演示

```
![演示](https://hits.zkitefly.eu.org/?tag=https://github.com/zkitefly/CloudFlare_Workers-hits)
```

![演示](https://hits.zkitefly.eu.org/?tag=https://github.com/zkitefly/CloudFlare_Workers-hits)

## 许可证

[MIT](/LICENSE)