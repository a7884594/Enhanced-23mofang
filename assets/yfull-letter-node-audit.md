# YFull A—T根节点核查（2026-09-06）

20个23魔方入口对应的YFull根节点已实际读取。9组异名、11组同名。只核查根名称和SNP，不代表完整下载全部下游样本。

| 入口 | 23魔方实际节点 | YFull节点 | 对应依据 |
| --- | --- | --- | --- |
| A | A-P305 | [A1](https://www.yfull.com/tree/A1/) | P305 |
| B | B-M8720 | [B](https://www.yfull.com/tree/B/) | M8720/V2144 |
| C | C-M130 | [C](https://www.yfull.com/tree/C/) | M130/PAGE51/RPS4Y711/PAGES00051/RPS4Y |
| D | D | [D](https://www.yfull.com/tree/D/) | 同名根节点 |
| E | E | [E](https://www.yfull.com/tree/E/) | 同名根节点 |
| F | F-M89 | [F](https://www.yfull.com/tree/F/) | M89/PF2746 |
| G | G | [G](https://www.yfull.com/tree/G/) | 同名根节点 |
| H | H | [H](https://www.yfull.com/tree/H/) | 同名根节点 |
| I | I-M170 | [I](https://www.yfull.com/tree/I/) | M170/PF3715 |
| J | J-M304 | [J](https://www.yfull.com/tree/J/) | M304/PAGE16/PF4609/PAGES00016 |
| K | K-L469 | [K](https://www.yfull.com/tree/K/) | L469/PF5499/M2689 |
| L | L | [L](https://www.yfull.com/tree/L/) | 同名根节点 |
| M | M | [M](https://www.yfull.com/tree/M/) | 同名根节点 |
| N | N-M231 | [N](https://www.yfull.com/tree/N/) | M231/PAGE91/PAGES00091 |
| O | O-F175 | [O](https://www.yfull.com/tree/O/) | F175 |
| P | P | [P](https://www.yfull.com/tree/P/) | 同名根节点 |
| Q | Q | [Q](https://www.yfull.com/tree/Q/) | 同名根节点 |
| R | R | [R](https://www.yfull.com/tree/R/) | 同名根节点 |
| S | S | [S](https://www.yfull.com/tree/S/) | 同名根节点 |
| T | T | [T](https://www.yfull.com/tree/T/) | 同名根节点 |

A特别说明：23魔方A入口实际显示A-P305；YFull的A与A-P305路径均返回404，A1路径返回200且根SNP包含P305，故只建立A-P305→A1，不建立A→A1。

其他11个入口D、E、G、H、L、M、P、Q、R、S、T保持同名精确查询。8个带SNP根名的单字母对应加A1共9组；扩展直接请求规范目标并在同一个返回页面核对根SNP，不再先访问已知404地址。缓存命中仍不重复请求。

YFull对应表独立于TheYtree；不使用泛化的首字母截断规则，也不把子支SNP当作根节点证据。若源站新响应缺失预期根SNP，标记未匹配而非继续套用。

原始根元数据：assets/yfull-root-audit.json。开发者复核脚本：node scripts/audit-yfull-roots.mjs（单并发，读取根头部后停止下载）。该脚本不会在用户日常浏览时运行。

150项自动测试通过，包括20入口单请求、缓存复用、下游排除、A导航区别及根证据缺失。真实核查仅根元数据，未重新安装扩展验证全部节点的完整样本查询。
