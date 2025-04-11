# CloudFlare Workers Hits Counter

一个基于 Cloudflare Workers 的简单访问计数器。

## 功能特性

- 提供SVG格式的访问计数器图片
- 支持网页统计视图,展示详细访问数据
- 自动清理30天前的访问记录
- 保存历史访问统计数据
- 支持多个计数器标签

## 使用方法

### 1. 计数器图片

在你需要显示计数器的地方插入以下代码:

```markdown
![visitors](https://your-worker.username.workers.dev/?tag=your-tag)
```

### 2. 网页统计视图

访问以下地址查看详细的访问统计信息:

```
https://your-worker.username.workers.dev/?tag=your-tag&web=true
```

网页统计视图包含:
- 总访问量统计
- 今日访问量统计
- 最近30天的访问趋势图表

### 3. 总览页面

访问以下地址查看所有计数器的总览页面:

```
https://your-worker.username.workers.dev/?web=true
```

总览页面包含:
- 所有计数器的总访问量统计
- 每个计数器的详细访问数据

## 演示

```
![演示](https://hits.zkitefly.eu.org/?tag=https://github.com/zkitefly/CloudFlare_Workers-hits)
```

![演示](https://hits.zkitefly.eu.org/?tag=https://github.com/zkitefly/CloudFlare_Workers-hits)

[演示](https://hits.zkitefly.eu.org/?tag=https://github.com/zkitefly/CloudFlare_Workers-hits&web=true)

## 部署说明

1.拷贝 [workers.js](/workers.js) 的所有完整代码；

2.打开 [dash.cloudflare.com](https://dash.cloudflare.com/)，进入 `Workers 和 Pages` 页面，点击`创建`；

3.点击 `Hello world` 跳过模板设置；

4.设置名称，并点击 `部署`；

5.点击 `编辑代码`，将第一步拷贝的代码覆盖进去，点击 `部署`；

6.返回并进入设置，在 绑定 处添加 `D1 数据库` 绑定，变量名设置 `DB`，然后再选择数据库（如果没有则在 `存储和数据库` - `D1 SQL 数据库` 创建），并点击 `部署`。

7.完成！

## 注意事项

- 访问数据保留最近30天的详细记录
- 超过30天的数据会被归档为按天统计的形式
- 建议定期备份数据库

## License

[MIT](/LICENSE)