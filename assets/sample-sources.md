# 多源公开样本：来源与口径（1.4.0）

采集与核查日期：2026-09-06。仅在用户点击后读取选定支系。三个来源不构成一棵统一树，数量不合并为去重人数。

## YFull

- 页面：https://www.yfull.com/tree/R-YP5527/ 、https://www.yfull.com/tree/R-CTS4385/
- 读取公开HTML的`ul#tree`节点层级、节点展示SNP及`title`中的额外SNP、样本匿名编号、公开地区、明确Ancient DNA标签及公开年代注释。
- R-YP5527：本节点基部分组R-YP5527*有YF006680；下游R-YP6497有YF011107、YF001896。星号保留在实际挂载名称中，本节点查询包含该节点的星号基部分组。
- 标记Ancient DNA才归入古DNA；未明确区分科研/个人的现代记录保留为“现代（个人/科研未细分）”。不会按YF、NA或其他编号前缀直接决定科研或个人类别。
- 多个可能挂载等源站注释保留并标为待核对。树页面缺失、重定向到其他节点、访问失败不记为0条。
- 公开论文检索：https://www.yfull.com/paper/list/ 。本版不遍历全站论文表，不将未建立论文关联的记录强行归入科研。
- 页面页脚注明CC BY 4.0；本地测试夹具裁剪至树HTML，删除脚本、页面账户等无关内容。来源署名保留为YFull。没有宣称拥有数据。

## FTDNA Discover

- 页面：https://discover.familytreedna.com/y-dna/R-CTS4385/classic
- 经实际页面脚本核实的公开数据路径：https://discover.familytreedna.com/resources/classictree-y/R-CTS4385.json 。R-YP5527同路径文件也已实际读取成功。
- 只读取Classic Tree公开node、children、variants、synonyms、ancient、modern数据。没有读取账户、DNA Matches或私有结果接口。
- `ancient`中的不确定挂载/预览记录单独注明；年代以源站文字为准，不拿节点TMRCA当作样本年代。
- `modern`行没有稳定样本编号，只汇总公开地区与实际挂载；不复制birth_year，不生成“个人样本ID”。未公开明细的状态与明确空结果区分。现代数据未细分个人/科研，显示相应说明。
- 国家地区口径官方说明：https://help.familytreedna.com/hc/en-us/articles/6463909777295-Understanding-the-Y-DNA-Discover-Time-Tree
- 所有数据版权归Gene by Gene / FamilyTreeDNA；本包仅按用户要求本地使用。测试夹具删除现代出生年，只保留解析所需公开树字段。

## TheYtree

- 沿用现有扩展已验证的公开树路径`/api/ysnp/theytree/?haplogroup=`与按需子树路径`/api/ysnp/theytree/node/?hid=`。
- 明确stype=2古人、1科研、0个人；null和未知类型不作为个人。个人只保留AU编号、公开地区、挂载与实际详情链接，名字、自由文本、质量及联系人字段均丢弃。
- 复用已有的TheYtree已核实对应缓存；不把TheYtree别名自动复制给YFull/FTDNA。
- R-YP5527本次真实HTTP请求500，未取得该来源可用数据；不能把这个结果解释为确认缺少节点或样本。

## 资源与完整性

- 请求由现有全局队列调度，多源树请求单并发，至少500ms启动间隔，25秒请求超时。
- 7天本地缓存；最多20项、合计4MB，超限只淘汰本模块旧缓存，不动原古DNA/科研缓存。
- 初次读取当前公开子树；未完整展开时保留部分状态。用户点击继续后每次最多读取8个待加载子树，受限时停止并保留已有结果。含下游结果仅按来源自身父子关系选取。
- 每个来源每页先渲染50条，用户主动加载更多；不默认预抓整棵树。原“古/研”角标仍表示TheYtree缓存，三源数据由“样”入口分别查看。
- 暂未实现无同名返回时的全站别名搜索，也没有证明跨站编号相同即为同一个人。保留来源边界及不确定性。

## 验证方式

135项自动测试通过；YFull和FTDNA两个指定支系已下载公开数据并测试解析。Edge本地模拟侧栏展示已检查，FTDNA正常公开网页已核对。未重新安装扩展验证用户浏览器权限及跨域请求全链路。

可用`npx tsx scripts/samples-preview.ts`运行本地预览；其中TheYtree为明确标注的失败模拟。


## 1.4.1 FTDNA节点名称核对

依据源站公开脚本中的checkYdnaLink和checkHaplo流程，原文件403/404时读取 https://discover.familytreedna.com/HaplogroupSearch/O-F175 ，返回O-M175；再核对 https://discover.familytreedna.com/resources/classictree-y/O-M175.json 根节点SNP包含F175。只有这一双重证据成立才改用标准名。并非将403作为任意重试或跳过访问控制的理由。测试夹具ftdna-O-M175-root.json只保留真实根节点名称、variants、synonyms；空样本和children是测试裁剪，不代表源站无样本。


## 1.4.2 续查完整性修正

YFull R-FGC9988公开HTML于2026-09-06重新采集并裁剪为树测试夹具。空星号分组为已加载的基部分组，不能据空列表反复请求。TheYtree子项响应通过已请求父节点ID建立上下文，拒绝无关默认树；有样本子项即不应仅因没有子支而被判为未加载，low_count不足仍保留待加载。无进展时暂停该子树，刷新后可重试。
