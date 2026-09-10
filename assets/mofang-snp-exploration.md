# 23魔方SNP位置查询探索（2026-09-06）

## 1.5.26 实测后的取数修正（2026-09-10）

1.5.25在全新报告页直接查得MF109928为hg19:14389057 C→A、MF920605为hg19:15711271 C→A；公共页节点详情补查仍无坐标。原站报告页先调用 `getSimpleTree(barcode)`，坐标已存在其树节点rsids中。1.5.26复用该只读客户端方法，在公共查询已核实所属节点后读取当前报告简化树，只提取目标节点的指定SNP坐标；仍保留无坐标时的节点详情补查。MAIN内临时处理，不持久化报告树，不向消息桥传递账号、编号或完整响应。2026-09-10用户安装1.5.26后，实际公共页原查询面板已成功显示MF109928（hg19:14389057 C→A）和MF920605（hg19:15711271 C→A），完成端到端验收。

## 1.5.25 集成更新（2026-09-10）

查询面板现传递所属节点提示，MAIN桥接从本页正式节点数据重新校验归属；确认后直接补查当前报告，避免公共 SNP 关键词查询失败提前返回。报告树增加 `.gene-origin-tree g.node / text.nodeText` 读取，并支持组件 `matchList` 的已加载位置。同名多节点要求指定所属节点，报告或账号切换后的结果丢弃。新版已通过200项回归测试及类型检查、构建；真实登录补查仍待用户重载扩展后验收。

本次修改前的浏览器对照已确认 MF920605 手动加载节点后能在插件显示 hg19:15711271 C→A；完整研究见 `mofang-snp-integration-research-20260910.md`。

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

1.5.0版本没有调用`postHaploidDetail`（`/proxy/v1/ancestry_report/haplogroup_trees/node_descriptions/_single_filter_by_haplogroup`），因为它与barcode、匹配状态、宗亲等个人报告信息相关。1.5.0未使用个人报告接口；1.5.3按用户新增请求，在当前自有报告范围内进行补查，见下文。

## 已知验证边界

- 直接外部请求公开节点接口实测412，不能当作“位点不存在”。网页客户端负责其正常请求上下文。
- MF920605坐标hg19:15711271 C→A来自用户截图。自动测试使用按网页解析规则构造的字符串验证展示，不声称该坐标由此次实际API查询取得。
- 实际浏览器确认公开页面SNP弹层仅展示名称。桥接与来源切换经过本地模拟测试，尚未重载用户扩展验证实际带登录环境的查询结果。
- 新增报告页快捷入口不改变网站权限、检测服务状态或已加载的数据范围。仍然可能无法取得某个位点的坐标；TheYtree结果保留独立来源。


## 1.5.3 当前账号报告内后台补查

用户要求可查询的数据在后台取得、不支持则提示。扩展在用户点击后调用网页原生postHaploidDetail({haplogroup, barcode:当前报告, show_clan_relation:false})；barcode只留在MAIN世界并由原生客户端发往23魔方，不向其他来源发送、不持久化。

仅已登录且有当前报告、非示例非分享上下文允许这一步。先验证SNP属于解析出的节点，随后只提取当前查询对应的坐标与突变。无坐标/业务拒绝为unsupported，网络异常为失败，未登录或报告未选择另行提示；不会根据姓名、宗亲关系或公共父系分支推断查询权限。

账号标识与报告上下文只用于查询开始和结束的本地一致性检查，切换后旧数据不回传。所有账号范围补查验证目前是本地模拟，实际源站权限和返回字段仍可能导致不支持；没有声称突破网站访问限制。
