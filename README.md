# AFSIM WSF Script — VS Code 语言支持插件

AFSIM WSF Script（Us Script）文件的语法高亮、自动补全、悬浮提示、代码片段、跨文件导航和定义跳转。

## 功能

### 语法高亮

- **关键字**：`if`、`else`、`else if`、`for`、`foreach`、`while`、`do`、`break`、`continue`、`return`、`in`、`when`、`global`、`static`、`extern`、`on`、`off`、`enable`、`disable`
- **类型**：基础类型（`string`、`int`、`double`、`char`、`bool`、`void`、`var`、`Object`、`struct`）、容器类型（`Array<T>`、`Map<K,V>`、`Set<T>`）、AFSIM 领域类型（`WsfPlatform`、`WsfProcessor`、`WsfSensor` 等 28 个）
- **常量**：`true`、`false`、`null`
- **注释**：`#` 行注释、`//` 行注释、`/* */` 块注释
- **字符串**：双引号字符串（含转义）、单引号字符字面量
- **数字**：整数、浮点、科学计数法（`1e-10`）
- **预处理器**：`$<var>$`、`$<var:default>$`、`$(var)`、`$define var value`
- **C 风格强制转换**：`(WsfTrackMessage)MESSAGE`
- **Block 命令**：`platform_type`...`end_platform_type`、`processor`...`end_processor`、`sensor`...`end_sensor`、`weapon`...`end_weapon`、`comm`...`end_comm`、`mover`...`end_mover`、`route`...`end_route` 等 28 对 block 的语法高亮
- **回调块**：`on_initialize`、`on_update`、`on_message`、`on_entry`、`state`/`next_state`、`phase`/`next_phase`、`execute`、`script_variables` 等
- **方法调用**：`.method()` 高亮、静态方法 `MATH.cos()` 高亮

### 自动补全

- **关键字**：含描述和代码片段
- **类型名**：基础类型、容器类型、全部 28 个领域类型
- **内置变量**：`PLATFORM`、`PROCESSOR`、`TRACK`、`TIME_NOW`、`MESSAGE`、`SELF`
- **方法补全**：输入 `.` 后触发，覆盖 350+ 个方法：
  - `WsfPlatform`：56 个方法（`Name()`、`Side()`、`Location()`、`SlantRangeTo()`、`Fuel()`、`TurnToHeading()`、`GoToAltitude()` 等）
  - `WsfTrack`：41 个方法（`TrackId()`、`ReportedLocation()`、`CurrentLocation()`、`Range()`、`Bearing()`、`Elevation()` 等）
  - `WsfDraw`、`WsfRouteFinder`、`WsfGeoPoint`、`WsfComm`、`FileIO`、`ArrayIterator` 等新增类型
  - 容器类型：`Size()`、`Empty()`、`PushBack()`、`GetIterator()` 等
- **静态方法补全**：`MATH.`、`Vec3.`、`Format.`、`WsfSimulation.`、`FileIO.`、`struct.` 后触发对应静态方法
- **全局函数**：`write_str()`、`writeln()`、`writeln_d()`、`FireAt()`、`SelectPhase()`、`FollowRoute()` 等 11 个
- **单位补全**：输入数字后按空格，弹出 50+ 个单位（见下方）

### 单位自动补全

| 类别 | 单位 |
|------|------|
| 时间 | `sec`、`seconds`、`min`、`minutes`、`hr`、`hours`、`day`、`days` |
| 距离 | `ft`、`feet`、`kft`、`m`、`meters`、`km`、`nm`、`nmi`、`miles` |
| 高度 | `ft msl`、`ft agl`、`m msl`、`m agl` |
| 速度 | `kts`、`knots`、`mph`、`m/s`、`ft/s`、`ft/min`、`fpm` |
| 角度 | `deg`、`degrees`、`rad`、`deg/s`、`rad/s`、`deg/s^2`、`rad/s^2`、`rpm` |
| 重量 | `kg`、`lbs`、`lb` |
| 流量 | `kg/s`、`lb/s`、`lbs/sec`、`lb/hr`、`kg/sec` |
| 频率 | `Hz`、`kHz`、`MHz`、`GHz`、`dB`、`dBm` |
| 其他 | `m^2`（RCS）、`kN`（推力）、`lbf`、`lbm` |

### 悬浮提示 (Hover)

鼠标悬停在关键字、类型名、方法名、内置变量、block 命令上时显示描述和签名。覆盖所有 350+ 方法和 30+ block 命令。

### 代码片段

| 前缀 | 说明 |
|------|------|
| `script` | 脚本函数块 |
| `if` / `ife` / `eif` | if / if-else / else-if 语句 |
| `for` / `foreach` / `foreachkv` | 循环 |
| `while` / `dowhile` | 循环 |
| `func` / `extern` / `ret` / `var` | 函数/外部声明/返回/变量 |
| `writes` / `writeln` / `writelnd` | 调试输出 |
| `struct` | 创建 struct 实例 |
| `script_variables` / `on_initialize` / `on_update` / `on_message` | 事件块 |
| `state` / `phase` | 状态机/制导阶段块 |
| `platform_type` / `execute` / `callback` | 平台类型/定时执行/回调块 |
| `fileio` | 文件读写模式 |
| `fireat` | 开火命令 |
| `wsfdraw` / `routefinder` | 绘图/路径规划模式 |
| `MATH` / `Vec3` / `Format` | 静态方法调用（带下拉选择） |
| `$define` | 预处理器定义 |
| `array` / `map` / `set` | 容器变量声明 |

### 跨文件导航

- **include 跳转**：Ctrl+点击 `include_once` 或 `include` 后的文件路径，自动打开被引用的文件
- **变量解析**：自动识别 `define_path_variable` 和 `$define` 定义的变量，解析 `${VAR}` 引用
- **路径搜索**：优先从 `file_path` 指定目录查找，自动回退到父目录

### 定义跳转 (Go to Definition)

F12 或 Ctrl+点击类型名，跳转到定义位置：

| 语句示例 | 可跳转的词 | 跳转目标 |
|----------|-----------|---------|
| `platform Talon_1_1 BLUE_FIGHTER` | `BLUE_FIGHTER` | `platform_type BLUE_FIGHTER ...` |
| `sensor rdr1 aesa` | `aesa` | sensor 定义 |
| `weapon fox3 MEDIUM_RANGE_RADAR_MISSILE` | `MEDIUM_RANGE_RADAR_MISSILE` | weapon 定义 |
| `processor thinker WSF_BRAWLER_PROCESSOR` | `WSF_BRAWLER_PROCESSOR` | processor 定义 |
| `comm datalink WSF_COMM_TRANSCEIVER` | `WSF_COMM_TRANSCEIVER` | comm 定义 |
| `mover WSF_AIR_MOVER` | `WSF_AIR_MOVER` | mover 定义 |
| `platform_type BLUE_FIGHTER LTE_FIGHTER` | `LTE_FIGHTER` | 父类型定义 |

搜索范围：当前文件 → include 文件 → 传递 include 文件，自动解析变量路径。

### 语言配置

- **注释切换**：`Ctrl+/` 切换 `//`，`Ctrl+Shift+/` 切换 `/* */`
- **括号自动闭合**：`{}`、`[]`、`()`、`""`、`''`
- **代码折叠**：支持全部 ~40 对 block 命令折叠（`script`/`end_script`、`platform`/`end_platform` 等）

## 文件关联

- `.txt` 文件自动检测：跳过空行和注释行后，如果第一行以 WSF banner（`# *****`）或任一 WSF 块命令开头，自动切换为 WSF Script 语言模式
- 支持的块命令包括：`platform_type`、`platform`、`simulation`、`sensor`、`processor`、`weapon`、`comm`、`mover`、`route`、`waypoint`、`zone`、`track`、`aux_data`、`edit`、`script_variables`、`on_initialize`、`on_update`、`on_message`、`state`、`phase`、`network`、`event_pipe`、`event_output`、`callback`、`file_path`、`include`、`include_once`、`$define` 等

## 安装

### 从 VSIX 安装

```bash
code --install-extension afsim-language-support-0.1.0.vsix
```

或在 VS Code 中：`Ctrl+Shift+P` → "Extensions: Install from VSIX..." → 选择 `.vsix` 文件。

### 从源码编译

```bash
npm install
npm run compile
# 在 VS Code 中按 F5 启动扩展开发宿主
```

### 打包 VSIX

```bash
npm install -g @vscode/vsce
vsce package
```

## 关于 WSF Script

WSF Script（也称 Us Script）是 AFSIM（Advanced Framework for Simulation, Integration, and Modeling）的脚本语言，嵌入在 WSF 场景文件的 `script ... end_script` 块中，用于：

- 调试监视变量
- 自定义仿真行为
- 数据检查与分析

语言为 C 风格语法，支持泛型容器类型（`Array<T>`、`Map<K,V>`、`Set<T>`）、动态成员访问（`.method()`）和丰富的 AFSIM 领域类型。
