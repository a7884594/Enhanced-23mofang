# 用户所列行政区域补图核查（1.3.0）

共 101 个地区：85 个可着色，16 个暂缺独立边界。

这是对用户提供的地区名称进行的本地匹配核查，不是重新抓取用户当前支系。代码取自边界快照；台湾用模拟71前缀代码测试跨编码映射。频率测试用固定小数验证保真，扩展运行时始终读取网站原值。

旧区划按城市整组切换至DataV旧版边界，避免旧县与合并后新区重叠。旧版接口未声明统一测绘年份，因此标为“旧版边界”，不宣称是精确的某年行政界线。全量原始下载摘要见 map-provenance.json。

| 网站地区 | 处理结果 | 边界来源 / 说明 |
| --- | --- | --- |
| 江西省 / 赣州市 / 龙南县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/360700_full.json) |
| 江西省 / 南昌市 / 湾里区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/360100_full.json) |
| 海南省 / 省直辖县级行政区划 / 昌江黎族自治县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 五指山市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 琼中黎族苗族自治县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 白沙黎族自治县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 东方市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 保亭黎族苗族自治县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 乐东黎族自治县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 澄迈县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 临高县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 琼海市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 文昌市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 万宁市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 陵水黎族自治县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 定安县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 海南省 / 省直辖县级行政区划 / 屯昌县 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 台湾省 / 台湾省 / 嘉义市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 基隆市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 南投县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 新竹县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 屏东县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 花莲县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 苗栗县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 新竹市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 台中市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 云林县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 彰化县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 桃园市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 台北市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 台南市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 宜兰县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 新北市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 高雄市 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 嘉义县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 台湾省 / 台湾省 / 澎湖县 | 县市名称跨编码映射 | [边界数据](https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson) |
| 广西壮族自治区 / 南宁市 / 横县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/450100_full.json) |
| 广西壮族自治区 / 百色市 / 平果县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/451000_full.json) |
| 福建省 / 漳州市 / 龙海市 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/350600_full.json) |
| 福建省 / 漳州市 / 长泰县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/350600_full.json) |
| 福建省 / 三明市 / 沙县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/350400_full.json) |
| 福建省 / 三明市 / 梅列区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/350400_full.json) |
| 浙江省 / 杭州市 / 下城区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/330100_full.json) |
| 浙江省 / 杭州市 / 江干区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/330100_full.json) |
| 湖南省 / 益阳市 / 益阳市大通湖管理区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 湖南省 / 永州市 / 永州市金洞管理区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 湖南省 / 永州市 / 永州市回龙圩管理区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 湖南省 / 永州市 / 祁阳县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/431100_full.json) |
| 湖南省 / 岳阳市 / 岳阳市屈原管理区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 湖南省 / 常德市 / 常德市西洞庭管理区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 湖南省 / 怀化市 / 怀化市洪江管理区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 湖北省 / 省直辖县级行政区划 / 神农架林区 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 湖北省 / 省直辖县级行政区划 / 潜江市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 湖北省 / 省直辖县级行政区划 / 天门市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 湖北省 / 省直辖县级行政区划 / 仙桃市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 湖北省 / 黄冈市 / 龙感湖管理区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 湖北省 / 荆州市 / 监利县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/421000_full.json) |
| 安徽省 / 芜湖市 / 弋江区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/340200_full.json) |
| 安徽省 / 芜湖市 / 繁昌县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/340200_full.json) |
| 安徽省 / 芜湖市 / 芜湖县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/340200_full.json) |
| 安徽省 / 芜湖市 / 无为县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/340200_full.json) |
| 安徽省 / 芜湖市 / 三山区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/340200_full.json) |
| 安徽省 / 滁州市 / 苏滁现代产业园 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 江苏省 / 镇江市 / 镇江新区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 江苏省 / 南通市 / 港闸区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/320600_full.json) |
| 江苏省 / 南通市 / 海门市 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/320600_full.json) |
| 四川省 / 成都市 / 新津县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/510100_full.json) |
| 四川省 / 凉山彝族自治州 / 会理县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/513400_full.json) |
| 贵州省 / 毕节市 / 黔西县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/520500_full.json) |
| 贵州省 / 六盘水市 / 水城县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/520200_full.json) |
| 山东省 / 烟台市 / 长岛县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/370600_full.json) |
| 山东省 / 烟台市 / 蓬莱市 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/370600_full.json) |
| 吉林省 / 四平市 / 公主岭市 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/220300_full.json) |
| 云南省 / 楚雄彝族自治州 / 禄丰县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/532300_full.json) |
| 云南省 / 玉溪市 / 澄江县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/530400_full.json) |
| 黑龙江省 / 大兴安岭地区 / 新林区 | 暂未着色 | 旧版与现有地图均未提供新林区独立边界，保留原频率等待补图 |
| 黑龙江省 / 大兴安岭地区 / 加格达奇区 | 统计代码映射 | 23魔方离线边界 |
| 河北省 / 邢台市 / 桥东区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/130500_full.json) |
| 河北省 / 邢台市 / 任县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/130500_full.json) |
| 河北省 / 邢台市 / 邢台县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/130500_full.json) |
| 河北省 / 邢台市 / 南和县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/130500_full.json) |
| 河北省 / 邢台市 / 桥西区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/130500_full.json) |
| 河北省 / 保定市 / 保定白沟新城 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 河北省 / 邯郸市 / 邯郸冀南新区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 河北省 / 沧州市 / 沧州渤海新区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 河南省 / 郑州市 / 郑州航空港经济综合实验区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 河南省 / 洛阳市 / 孟津县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/410300_full.json) |
| 河南省 / 洛阳市 / 偃师市 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/410300_full.json) |
| 河南省 / 洛阳市 / 吉利区 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/410300_full.json) |
| 河南省 / 省直辖县级行政区划 / 济源市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 山西省 / 晋中市 / 太谷县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/140700_full.json) |
| 陕西省 / 安康市 / 旬阳县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/610900_full.json) |
| 陕西省 / 宝鸡市 / 凤翔县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/610300_full.json) |
| 内蒙古自治区 / 锡林郭勒盟 / 乌拉盖管委会 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 甘肃省 / 兰州市 / 兰州新区 | 暂未着色 | 管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替 |
| 青海省 / 西宁市 / 湟中县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/630100_full.json) |
| 新疆维吾尔自治区 / 自治区直辖县级行政区划 / 五家渠市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 新疆维吾尔自治区 / 自治区直辖县级行政区划 / 阿拉尔市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 新疆维吾尔自治区 / 自治区直辖县级行政区划 / 石河子市 | 直辖县级边界启用 | 省直辖县级地区：使用23魔方原有独立边界 |
| 新疆维吾尔自治区 / 塔城地区 / 沙湾县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/654200_full.json) |
| 新疆维吾尔自治区 / 阿克苏地区 / 库车县 | 旧版区划着色 | [边界数据](https://geo.datav.aliyun.com/areas/bound/652900_full.json) |

管理区/功能区不能用整县边界代替。已检查DataV普通版与v2区县列表及可用独立代码，相关独立几何未取得；新林区同样缺图。未来补图需同时核查统计范围与边界版本。
