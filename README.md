# dsh-model-catalog

针对 [misakano7545/workbuddy2api-panel](https://github.com/misakano7545/workbuddy2api-panel) 写的模型目录面板，让dsh开启的时候自动更新模型名称，主要是为了区分国际版国内版以及显示积分倍率，比如原本是id为cn:glm-5.3-flash，name为GLM-5.3-Flash，用{prefix}{name} [{credits}]之后就是cn:GLM-5.3-Flash [x0.08]

以下信息都是ai写的，不一定靠谱，建议让ai自己读取自己装插件

在 DSH 里展示模型目录的**积分倍率、描述、思考强度、上下文/输出、视觉支持**，并把这些信息按模型 id 同步到 `@deepseek-ai/dsh-llm-pi-ai` 的指定模型组，让 DSH 自带的模型选择器也能显示倍率与思考档位。

## 功能

- **启动同步**：DSH 启动后自动请求 `GET {baseURL}/models`，按 id 刷新**已导入模型**的 `name`（含最新积分倍率）、思考档位、上下文与输出；不会自行新增或删除模型。面板里可关闭。
- **连接配置面板**：接口地址、API Key 引用、模型组、显示名称、协议都在面板里配置，源码不内置任何网关地址或密钥。
- **从已有模型组引入**：下拉选择 `llm-pi-ai` 里已经配置好的模型组，自动带出它的 `baseURL`、`apiKeyEnv`、显示名和协议；也可以新建模型组。
- **密钥安全**：密钥通过面板写入 DSH 凭据服务，插件状态文件只保存凭据引用名，不保存密钥值。
- **按 id 同步**：
  - `name` ← 名称模板（默认 `{prefix}{name} [{credits}]`，例如 `cn:DeepSeek-V4.1-Flash [x0.11]`、`global:GPT-6-Astra [x6.67]`）
  - `reasoningEfforts` ← `reasoning_supported_efforts`
  - 同时同步 `contextWindow`、`maxTokens`、`input`
  - 模型组里的 `models[]` 顺序统一按模型 id 排序（自然序：`4.9` 在 `4.10` 前面），每次同步都会覆盖原有顺序
- **模型面板**：多选勾选要保留的模型、搜索、按国内/国际/已导入/已下架筛选、设为默认模型、修改名称模板、刷新目录、同步到 DSH。设为默认只改 DSH 的默认选择，不改模型组配置；模型组里没有的模型或档位会提示先同步。
- **入口**：左侧栏「模型目录」图标；以及「设置 → 模型目录」。

## 安装

### 插件管理器

```text
插件管理 → 从本地文件夹安装 → 选择本目录
```

### DSH CLI（推荐给其他机器）

```bash
# 直接装 GitHub 仓库
dsh plugin --profile <profile> add github:Thiasap/dsh-model-catalog

# 或装指定版本的 Release 包
dsh plugin --profile <profile> add https://github.com/Thiasap/dsh-model-catalog/releases/download/v1.2.2/dsh-model-catalog-1.2.2.tgz

# 本地目录
dsh plugin --profile <profile> add /path/to/dsh-model-catalog
```

> `github:user/repo` 装的是仓库默认分支的最新提交；想要可复现版本就用 Release 的 tarball 链接。

安装后刷新一次页面（F5），左侧栏会出现「模型目录」图标。

## 配置

打开面板 →「连接配置」：

1. **模型组**：从已有模型组里选一个（会带出地址和密钥引用），或选「＋ 新建模型组」。
2. **接口地址**：形如 `https://your-gateway.example/v1`。
3. **API Key 引用**：填凭据名（环境变量名），例如 `MY_GATEWAY_KEY`；不是密钥本身。
4. **API Key**：粘贴密钥后点「保存密钥」，或点「保存并同步」时自动保存。密钥写入 DSH 凭据服务。
5. 点「保存并同步」。

名称模板支持：

```text
{prefix} {group} {name} {id} {credits} {description} {context} {maxTokens} {vendor} {tier}
```

- `{prefix}`：id 前缀，含冒号，例如 `cn:`、`global:`
- `{group}`：id 前缀，不含冒号，例如 `cn`、`global`

默认 `{prefix}{name} [{credits}]`。保存模板后会立即重写所选模型组的模型名称。

## 工作方式

- 启动后约 2.5 秒拉取一次模型目录；失败会保留上次目录并在面板顶部提示。
- **勾选即清单**：面板里勾选的模型就是希望 DSH 里保留的模型。首次打开时按当前模型组自动勾选。
- 点右上角「同步到 DSH」后：勾选项被导入/刷新（名称、上下文、输出、视觉、思考档位），未勾选的目录模型从模型组移除。
- 云端已下架的旧模型默认保留，并置顶标红提示；取消勾选或点行内「删掉」再同步即可清除。
- 启动时的自动同步只刷新已存在模型的字段，不会自行增删模型，避免手滑丢配置。
- 无论手动同步还是启动同步，写进模型组的模型都按 id 排序，DSH 模型选择器里的顺序因此固定下来；面板列表在「已下架 / 已导入 / 可导入」三组内部同样按 id 排序。
- 「显示名称模板」卡片下方的 **启动 DSH 时自动刷新名称与积分** 勾选框控制这个行为；关掉后启动时不再拉取目录，只保留手动「刷新目录 / 同步到 DSH」。
- 旧版本升级时，如果状态文件里没有连接字段，会根据已有目录自动匹配包含这些模型 id 的模型组。

## 数据与隐私

- 源码与默认配置不包含任何真实网关地址、API Key 或 provider 名。
- 密钥只保存在 DSH 凭据服务；插件状态文件只保存凭据引用名。
- 运行期状态文件默认在：

```text
$DSH_HOME/model-catalog/state.json
```

其中包含模型目录、名称模板、所选模型组的地址和凭据引用名，不包含密钥值。不要把该文件提交到仓库。

## 文件

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半侧：启动拉取、配置同步、HTTP 路由、凭据读写 |
| `client.js` | Client 半侧：侧栏入口、模型面板、设置页、连接配置 |
| `cordis.patch.yml` | bundle 行与默认配置（连接信息留空） |
| `locale/*.json` | 插件管理页的标题/描述 |
| `icon.svg` | 插件图标 |
| `LICENSE` | MIT 许可证 |

## 兼容性

在 DSH Desktop 的 `desktop` profile（DSH 0.2.1-rc.x）上验证。依赖 DSH 内置的 `webServer`、`credentials`、`configEditor`、`agentDefaultModel` 服务，以及 `@deepseek-ai/dsh-llm-pi-ai`。

## License

MIT. See [LICENSE](LICENSE).
