# 23魔方SNP位置查询探索（2026-09-06）

## 已确认的网站实现

- 用户指定入口：https://www.23mofang.com/report/ancestry
- 页面路由表中的宗亲分化树：https://www.23mofang.com/report/gene-origin/my-origin
- 公共应用脚本：https://static.23mofang.com/web/6fa5f6e.js
- 宗亲分化树页面脚本：https://static.23mofang.com/web/02ca168.js
- 公开Y树页面脚本：https://static.23mofang.com/web/5b2b121.js

宗亲分化树中点击名称调用showHaploidPosition：名称取字符串#前部分，位置取%后部分，按hg19显示。位置是在已加载的nodeRsIds等字符串中，不是每次点击弹窗都调用一个独立的SNP位置接口。相关位置按钮还依赖isYFullAndReportOut、isHighlight等报告和页面状态。

网页原生公开树也有getHaploidPosition函数；普通页面没有相应元数据时只展示名称。实测O-MF920596公开页面只含MF920596、MF920602、MF920603、MF920605、MF344705、MF920609、MF920613、MF920614。

## 接入方式与字段

调用网页原有`$api.ancestry`客户端的固定只读方法：

1. `getTreeDetailByNode(SNP, false)`：`GET /proxy/v1/ancestry_tree/diff_nodes/detail_node`，参数keyword与is_node_group_name。
2. `getTreeNodeById(node)`：`GET /proxy/v1/ancestry_tree/diff_nodes/{node}`。网页自己的fetchNodeDetail读取此响应data.rsids。

扩展只接受与查询名称精确一致的rsids条目及所属节点，不采用模糊匹配结果。若得到编码位置，展示hg19坐标与突变；只有名称则显示所属支系及“未提供坐标”。通过同源MAIN桥接使用网页自己的请求客户端，不读取/导出Cookie，不重构其签名参数，不从外部伪造客户端。

已加载页面的通用位置字段只读取正式节点rsids和组件haploidDetail.nodeRsIds，桥接返回仅包含指定SNP的名称、坐标、突变及来源地址；不返回整个报告对象。

没有调用`postHaploidDetail`（`/proxy/v1/ancestry_report/haplogroup_trees/node_descriptions/_single_filter_by_haplogroup`），因为它与barcode、匹配状态、宗亲等个人报告信息相关。本版没有用个人报告接口获取额外权限或补足坐标。

## 已知验证边界

- 直接外部请求公开节点接口实测412，不能当作“位点不存在”。网页客户端负责其正常请求上下文。
- MF920605坐标hg19:15711271 C→A来自用户截图。自动测试使用按网页解析规则构造的字符串验证展示，不声称该坐标由此次实际API查询取得。
- 实际浏览器确认公开页面SNP弹层仅展示名称。桥接与来源切换经过本地模拟测试，尚未重载用户扩展验证实际带登录环境的查询结果。
- 新增报告页快捷入口不改变网站权限、检测服务状态或已加载的数据范围。仍然可能无法取得某个位点的坐标；TheYtree结果保留独立来源。
