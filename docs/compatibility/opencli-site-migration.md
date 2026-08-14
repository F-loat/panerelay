# OpenCLI Site Migration

This document is the site-by-site migration record for the non-internal adapter directories under the OpenCLI repository's `clis/` directory. The source inventory was refreshed on 2026-08-10.

## Status rules

- **Supported** means the source site has a built-in adapter in `packages/sites/src`, is registered in `@panerelay/sites`, builds into the strict two-file installed form, and has isolated live E2E evidence. `Supported (subset)` means the site is available, while source commands outside the current fetch boundary are listed in the notes.
- **Pending** means an implemented fetch adapter still lacks successful live evidence because of a current login, challenge, upstream, or parser condition. It is not a claim that the site can never be supported.
- **Unsupported** means the source behavior is intentionally outside the current fetch-only migration scope. This includes DOM extraction and page navigation, as well as desktop/native control, local application state, user-managed API keys/tokens/client secrets, interactive OAuth/credential refresh, model-agent streaming, arbitrary local output, or multi-file/directory transfer. “Unsupported” records the present product boundary; it does not rule out a later, separately designed capability.
- Internal OpenCLI directories whose names start with `_` are excluded. Numeric-leading canonical names such as `12306` and `36kr` are used directly as adapter IDs.

## Coverage summary

| Source directories | Supported | Pending | Unsupported |
| -----------------: | --------: | ------: | ----------: |
|                176 |        92 |       7 |          77 |

Every one of the 176 source directories appears exactly once in the inventory below. The catalog contains 99 built-in IDs: 92 have successful isolated E2E evidence and 7 implemented adapters remain Pending after a blocked or inconclusive live attempt. Nine fetch probes were removed after proving that their successful OpenCLI paths require DOM/page or WAF runtime, and `rest-countries` was removed because its current upstream API requires a user-managed key.

## Complete inventory

### Supported

| OpenCLI adapter | Panerelay adapter and supported commands | Notes |
| --- | --- | --- |
| `12306` | `packages/sites/src/12306`; `me`, `orders`, `passengers`, `price`, `stations`, `train`, `trains` | The canonical numeric-leading site name is also the adapter ID. Login and `whoami` page workflows remain omitted because they require page interaction. |
| `1point3acres` | `packages/sites/src/1point3acres`; `digest`, `forum`, `forums`, `hot`, `latest`, `notifications`, `thread`, `user` | Supported after the user completed Cloudflare verification once in the selected browser and Fetch reused the resulting cookies. Isolated `hot` E2E passed; the other public commands returned their expected field sets, and `notifications` reached a typed empty result. `login`/`whoami` remain page-navigation/DOM workflows, while `search` depends on a Discuz redirect rejected by the current Fetch policy. Panerelay does not execute or bypass the challenge. |
| `apple-podcasts` | `packages/sites/src/apple-podcasts`; `episodes`, `search`, `top` | Public RSS and chart APIs. |
| `archive` | `packages/sites/src/archive`; `item`, `search`, `snapshots`, `wayback` | Public HTTP APIs. |
| `arxiv` | `packages/sites/src/arxiv`; `author`, `paper`, `recent`, `search` | Public Atom/API endpoints; fixture, CLI, and live coverage exist. |
| `autohome` | `packages/sites/src/autohome`; `brand`, `score` | Public endpoints used by the existing adapter. |
| `bbc` | `packages/sites/src/bbc`; `news`, `topic` | Public RSS feeds. |
| `bilibili` | `packages/sites/src/bilibili`; `comment`, `comments`, `dynamic`, `favorite`, `feed`, `feed-detail`, `follow`, `following`, `history`, `hot`, `me`, `ranking`, `search`, `subtitle`, `summary`, `unfollow`, `user-videos`, `video`, `whoami` | Cookie-backed and public commands; 15 representative live cases passed and the current sample's absent AI summary was classified as an expected empty result. Subtitle retrieval uses a separately authorized exact origin. Login itself is not claimed. |
| `binance` | `packages/sites/src/binance`; `asks`, `depth`, `gainers`, `klines`, `losers`, `pairs`, `price`, `prices`, `ticker`, `top`, `trades` | Public market endpoints. |
| `bluesky` | `packages/sites/src/bluesky`; `feeds`, `followers`, `following`, `profile`, `search`, `starter-packs`, `thread`, `trending`, `user` | Public AT Protocol endpoints. |
| `chess` | `packages/sites/src/chess`; `game`, `games`, `stats` | Public Chess.com API and callback endpoints. `analyze` is page navigation and omitted. |
| `coingecko` | `packages/sites/src/coingecko`; `categories`, `coin`, `derivatives`, `exchanges`, `global`, `top`, `trending` | Public market endpoints. |
| `crates` | `packages/sites/src/crates`; `crate`, `search` | Public crates.io registry API. |
| `dblp` | `packages/sites/src/dblp`; `author`, `paper`, `search`, `venue` | Public scholarly API. |
| `defillama` | `packages/sites/src/defillama`; `protocol`, `protocols` | Public API. |
| `devto` | `packages/sites/src/devto`; `latest`, `read`, `tag`, `top`, `user` | Public API. |
| `dictionary` | `packages/sites/src/dictionary`; `search`, `synonyms`, `examples` | Public dictionary endpoints. |
| `dockerhub` | `packages/sites/src/dockerhub`; `image`, `search` | Public registry API. |
| `duckduckgo` | `packages/sites/src/duckduckgo`; `suggest` | Search suggestions use a public JSON endpoint. `search` uses page DOM and in-page XHR. |
| `endoflife` | `packages/sites/src/endoflife`; `product` | Public API. |
| `flathub` | `packages/sites/src/flathub`; `app`, `search` | Public API. |
| `github-trending` | `packages/sites/src/github-trending`; `repos` | Public page/API-compatible extraction already implemented. |
| `google` | `packages/sites/src/google`; `news`, `suggest`, `trends` | Public suggestion and RSS endpoints. `search` and `images` use page DOM. |
| `goproxy` | `packages/sites/src/goproxy`; `module`, `versions` | Public Go module proxy API. |
| `hackernews` | `packages/sites/src/hackernews`; `ask`, `best`, `jobs`, `new`, `read`, `search`, `show`, `top`, `user` | Public Firebase and Algolia APIs. |
| `hf` | `packages/sites/src/hf`; `datasets`, `models`, `paper`, `spaces`, `top` | Public Hugging Face APIs. Auth and `whoami` are omitted. |
| `homebrew` | `packages/sites/src/homebrew`; `formula`, `cask`, `popular` | Public formula/cask APIs. |
| `juejin` | `packages/sites/src/juejin`; `hot`, `recommend` | Mirrors the OpenCLI public Juejin endpoints and row mapping. |
| `lesswrong` | `packages/sites/src/lesswrong`; `comments`, `curated`, `frontpage`, `new`, `read`, `sequences`, `shortform`, `tag`, `tags`, `top`, `top-month`, `top-week`, `top-year`, `user`, `user-posts` | Public GraphQL operations mirrored from OpenCLI. |
| `lichess` | `packages/sites/src/lichess`; `top`, `user` | Public API. |
| `lobsters` | `packages/sites/src/lobsters`; `active`, `domain`, `hot`, `newest`, `read`, `tag` | Public JSON endpoints. |
| `maven` | `packages/sites/src/maven`; `artifact`, `search` | Public Maven Central search API. |
| `mdn` | `packages/sites/src/mdn`; `search` | Public MDN search API. |
| `medium` | `packages/sites/src/medium`; `tag` | RSS-backed tag listing. OpenCLI `feed`, `search`, and `user` use Medium page DOM and remain omitted. |
| `npm` | `packages/sites/src/npm`; `downloads`, `package`, `search` | Public registry and downloads APIs. |
| `nuget` | `packages/sites/src/nuget`; `package`, `search` | Public NuGet APIs. |
| `nvd` | `packages/sites/src/nvd`; `cve` | Public NVD API. |
| `oeis` | `packages/sites/src/oeis`; `search`, `sequence` | Public OEIS API. |
| `openalex` | `packages/sites/src/openalex`; `search`, `work` | Public scholarly API. |
| `openfda` | `packages/sites/src/openfda`; `drug-label`, `food-recall` | Public API. |
| `openreview` | `packages/sites/src/openreview`; `author`, `paper`, `reviews`, `search`, `venue` | Public API. |
| `osv` | `packages/sites/src/osv`; `query`, `vulnerability` | Public vulnerability API. |
| `packagist` | `packages/sites/src/packagist`; `package`, `search` | Public API. |
| `pubmed` | `packages/sites/src/pubmed`; `article`, `author`, `citations`, `clinical-trial`, `journal`, `mesh`, `related`, `review`, `search` | Public NCBI APIs. OpenCLI's optional `NCBI_API_KEY` acceleration is intentionally not carried over. |
| `pypi` | `packages/sites/src/pypi`; `downloads`, `package` | Public package and download-statistics APIs. |
| `rfc` | `packages/sites/src/rfc`; `rfc` | Public RFC index/text retrieval. |
| `rubygems` | `packages/sites/src/rubygems`; `gem`, `search` | Public API. |
| `semanticscholar` | `packages/sites/src/semanticscholar`; `citations`, `paper`, `recommendations`, `search` | Public anonymous scholarly API. OpenCLI's optional `SEMANTIC_SCHOLAR_API_KEY` is intentionally not carried over, so anonymous rate limits apply. |
| `stackoverflow` | `packages/sites/src/stackoverflow`; `bounties`, `hot`, `read`, `related`, `search`, `tag`, `unanswered`, `user` | Public Stack Exchange API. |
| `steam` | `packages/sites/src/steam`; `app`, `search`, `top-sellers` | Public storefront endpoints. |
| `ths` | `packages/sites/src/ths`; `hot-rank` | Public Tonghuashun ranking endpoint. |
| `tvmaze` | `packages/sites/src/tvmaze`; `search`, `show` | Public API. |
| `wikidata` | `packages/sites/src/wikidata`; `entity`, `search` | Public API. |
| `wikipedia` | `packages/sites/src/wikipedia`; `page`, `random`, `search`, `summary`, `trending` | Public MediaWiki APIs. |
| `wttr` | `packages/sites/src/wttr`; `current`, `forecast` | Public weather endpoints. |
| `36kr` | `packages/sites/src/36kr`; `news` | The canonical numeric-leading site name is also the adapter ID. RSS-backed news passed isolated E2E. `article`, `hot`, and `search` remain page-DOM workflows. |
| `ctrip` | `packages/sites/src/ctrip`; `hotel-suggest`, `search` | Public destination search passed isolated E2E. Attraction, transport, hotel, package, tour, login, and account commands use page/interceptor/session workflows. |
| `dongchedi` | `packages/sites/src/dongchedi`; `koubei`, `models`, `score`, `search`, `series`, `specs` | Cookie-backed `__NEXT_DATA__` SSR access passed isolated E2E after the browser login was reused; anonymous requests now redirect to `/login-required`. |
| `eastmoney` | `packages/sites/src/eastmoney`; `announcement`, `convertible`, `etf`, `holders`, `index-board`, `kline`, `kuaixun`, `longhu`, `money-flow`, `northbound`, `quote`, `rank`, `sectors` | Public ranking API passed isolated E2E. `hot-rank` remains page-only. |
| `guazi` | `packages/sites/src/guazi`; `browse`, `car` | The current canonical desktop SSR HTML passed isolated E2E; the former mobile URL redirects and deep pagination/filtering uses a signed API. |
| `nowcoder` | `packages/sites/src/nowcoder`; `companies`, `creators`, `detail`, `experience`, `hot`, `jobs`, `notifications`, `papers`, `practice`, `recommend`, `referral`, `salary`, `search`, `suggest`, `topics`, `trending` | Public hot-list E2E passed. Interactive `login` remains omitted. |
| `paperreview` | `packages/sites/src/paperreview`; `feedback`, `review` | A bounded invalid-token review probe reached the upstream service without Bridge/Extension failure. `submit` requires a local PDF plus multipart/presigned-S3 upload. |
| `producthunt` | `packages/sites/src/producthunt`; `posts`, `today` | Public posts feed passed isolated E2E. `browse` and `hot` remain page-DOM commands. |
| `sinablog` | `packages/sites/src/sinablog`; `search` | Public search passed isolated E2E with a query that currently returns blog-domain rows. `article`, `hot`, and `user` remain page-DOM workflows. |
| `sinafinance` | `packages/sites/src/sinafinance`; `news`, `stock` | Public news and three-market stock APIs passed isolated E2E. `stock` requests Base64 response bytes and decodes GBK through site-kit; `rolling-news` and `stock-rank` remain page workflows. |
| `substack` | `packages/sites/src/substack`; `search` | Public search passed isolated E2E. `feed` and `publication` remain Cookie-backed page workflows. |
| `toutiao` | `packages/sites/src/toutiao`; `hot`, `recommend` | Public hot-board E2E passed. `articles`, login, and account checks remain page/session workflows. |
| `trip` | `packages/sites/src/trip`; `package`, `search` | Public destination search passed isolated E2E. Attraction, car, deal, flight, hotel, tour, train, and transfer commands remain page workflows. |
| `v2ex` | `packages/sites/src/v2ex`; `daily`, `hot`, `latest`, `me`, `member`, `node`, `nodes`, `notifications`, `replies`, `topic`, `user`, `whoami` | Public hot-list E2E passed. Interactive `login` remains omitted. |
| `weread` | `packages/sites/src/weread`; `ai-outline`, `book`, `book-search`, `highlights`, `notebooks`, `notes`, `ranking`, `search`, `shelf`, `whoami` | Public ranking E2E passed. Interactive `login` is omitted; private calls still require domain-scoped browser cookies. |
| `yollomi` | `packages/sites/src/yollomi`; `models` | Static model catalog passed isolated E2E. Generation, editing, upload, and download require authenticated page state and local media transfer. |
| `barchart` | `packages/sites/src/barchart`; `flow`, `greeks`, `options`, `quote` | Cookie-backed quote E2E passed after preserving the seeded page Referer and Origin with the page CSRF token. |
| `github` | `packages/sites/src/github`; `whoami` | Cookie-backed account-identity probe passed; OpenCLI's remaining source commands are interactive `login` and `logout`. |
| `google-scholar` | `packages/sites/src/google-scholar`; `profile`, `search` | Public search HTML passed isolated E2E. `cite` requires the interactive citation dialog and dynamically emitted export URL. |
| `hupu` | `packages/sites/src/hupu`; `detail`, `hot`, `mentions`, `search`, `whoami` | Public hot-list E2E passed. Like/unlike/reply still require page-local values that cookie bindings cannot transform into request bodies. |
| `instagram` | `packages/sites/src/instagram`; `comment`, `download`, `explore`, `follow`, `followers`, `following`, `like`, `profile`, `save`, `saved`, `search`, `unfollow`, `unlike`, `unsave`, `user`, `whoami` | Profile E2E passed with the current browser session. Publishing, Reel/Story/Note creation, and collection multipart workflows remain page/media workflows. |
| `linux-do` | `packages/sites/src/linux-do`; `categories`, `feed`, `search`, `tags`, `topic`, `topic-content`, `user-posts`, `user-topics` | Public Discourse feed E2E passed. |
| `pixiv` | `packages/sites/src/pixiv`; `detail`, `illusts`, `ranking`, `search`, `user` | Ranking E2E passed with the current Cookie path; login and local image-download workflows remain omitted. |
| `powerchina` | `packages/sites/src/powerchina`; `search` | Public procurement API passed isolated E2E; interactive auth commands remain omitted. |
| `reddit` | `packages/sites/src/reddit`; `comment`, `frontpage`, `home`, `hot`, `popular`, `read`, `reply`, `save`, `saved`, `search`, `subreddit`, `subreddit-info`, `subscribe`, `subscribed`, `upvote`, `upvoted`, `user`, `user-comments`, `user-posts`, `whoami` | Public popular-feed E2E passed. Writes still require `--execute`; interactive login remains omitted. |
| `reuters` | `packages/sites/src/reuters`; `article-detail`, `search` | Search E2E passed. DataDome, CAPTCHA, and paywall responses continue to fail closed. |
| `tieba` | `packages/sites/src/tieba`; `hot`, `posts` | Public hot-list E2E passed. Search/read still depend on hydrated Vue instance properties. |
| `wanfang` | `packages/sites/src/wanfang`; `search` | Public scholarly search E2E passed; client-only result pages may still return no rows. |
| `weibo` | `packages/sites/src/weibo`; `comments`, `delete`, `feed`, `hot`, `me`, `post`, `search`, `user`, `user-posts`, `whoami` | Public hot-list E2E passed. Login, favorites, and publish remain page/session/media workflows. |
| `xueqiu` | `packages/sites/src/xueqiu`; `comments`, `earnings-date`, `feed`, `fund-holdings`, `fund-snapshot`, `groups`, `hot`, `hot-stock`, `kline`, `search`, `stock`, `watchlist` | Hot-stock E2E passed after seeding the same-origin browser session before the JSON API request. |
| `yahoo-finance` | `packages/sites/src/yahoo-finance`; `quote` | Public chart API quote passed isolated E2E; source page-only commands remain omitted. |
| `zhihu` | `packages/sites/src/zhihu`; `answer`, `answer-comments`, `answer-detail`, `article-create`, `article-delete`, `article-draft`, `article-update`, `collection`, `collections`, `comment`, `comment-delete`, `download`, `favorite`, `follow`, `followers`, `following`, `hot`, `like`, `pins`, `question`, `recommend`, `search`, `user`, `user-answers`, `user-articles`, `whoami` | Public hot-list E2E passed. On 2026-08-13, a matching locally built adapter completed private-draft create, read, partial update with omitted-content preservation, read-back verification, delete, and absence verification in the signed-in daily Chrome profile using Browser Fetch, Cookies, and the manifest-owned `_xsrf` binding; `x-zst-81` was not required for this private-draft subset. On 2026-08-14, the matching adapter verified public-article read and Markdown export through `zhuanlan.zhihu.com`, plus owned `comment-delete` with transient-read retry and absence verification. `comment-update` remains Unsupported because no same-ID edit action exists. `article-publish`, published-article Site updates, and pin comments remain Unsupported because their current first-party requests require protected browser-generated headers or encoded bodies unavailable under RFC-0010; scheduling, media upload, local-file import, and public-article deletion are also Unsupported. Set `PANERELAY_E2E_ZHIHU_ARTICLE_ID` to an owned numeric article ID to include the non-mutating `article-draft` case in isolated E2E. Login remains interactive. |
| `boss` | `packages/sites/src/boss`; `detail`, `exchange`, `invite`, `joblist`, `mark`, `recommend`, `search`, `stats` | Cookie-backed search passed after the browser login was refreshed; interactive login remains omitted. |
| `douban` | `packages/sites/src/douban`; `book-hot`, `download`, `marks`, `movie-hot`, `photos`, `reviews`, `search`, `subject`, `top250`, `whoami` | Cookie-backed `whoami` passed after browser login. `movie-hot` currently returns no rows, and local-directory download remains omitted. |
| `quark` | `packages/sites/src/quark`; `ls`, `mkdir`, `mv`, `rename`, `rm`, `save`, `share-tree`, `whoami` | Cookie-backed `whoami` passed after accepting Quark's current `{ success, code, data }` response envelope. Writes require `--execute`; interactive login remains omitted. |
| `zsxq` | `packages/sites/src/zsxq`; `dynamics`, `groups`, `search`, `topic`, `topics`, `whoami` | Cookie-backed `whoami` passed after browser login; interactive login remains omitted. |
| `maimai` | `packages/sites/src/maimai`; `search-talents`, `whoami` | Cookie-backed `whoami` passed against Maimai's current same-origin Next data endpoint discovered from validated page metadata; no DOM extraction or navigation is used. |

### Pending

These implemented adapters remain eligible within the fetch boundary, but their latest isolated live evidence is blocked by login/challenge state or inconclusive because the same upstream/sample currently fails in OpenCLI too.

#### Implemented; isolated E2E failed or blocked

Each adapter below is cataloged and builds into the strict two-file form. OpenCLI comparison calls were made only for failures. DOM/page-runtime dependencies are classified as Unsupported below rather than Pending.

| OpenCLI adapter | Panerelay adapter and implemented commands | Remaining command or verification limitation |
| --- | --- | --- |
| `booking` | `packages/sites/src/booking`; `search` | E2E returned a Booking verification page; the corresponding OpenCLI invocation also failed. |
| `bloomberg` | `packages/sites/src/bloomberg`; `crypto`, `economics`, `feeds`, `green`, `industries`, `main`, `markets`, `opinions`, `politics`, `pursuits`, `tech` | Static feed discovery succeeds, but current live RSS requests for representative `main` and `crypto` feeds time out on both the browser-backed route and direct comparison route. `businessweek` and article `news` remain page/session workflows. |
| `huodongxing` | `packages/sites/src/huodongxing`; `events` | E2E returned HTTP 500; the corresponding OpenCLI invocation also failed. |
| `linkedin-learning` | `packages/sites/src/linkedin-learning`; `course`, `search`, `trending`, `whoami` | E2E lacked the browser `JSESSIONID` required for Voyager CSRF binding; the corresponding OpenCLI invocation also failed. |
| `flomo` | `packages/sites/src/flomo`; `memos` | The v3 adapter and unit tests use only a protected exact-origin `localStorage.me` binding ID. Live verification requires an already-open signed-in `https://v.flomoapp.com` tab; Panerelay intentionally does not navigate to create that state. |
| `uisdc` | `packages/sites/src/uisdc`; `news` | E2E returned zero rows and the corresponding OpenCLI invocation also failed, indicating current upstream/selector drift. |
| `uiverse` | `packages/sites/src/uiverse`; `code` | E2E received a non-JSON Remix response for the documented sample; the corresponding OpenCLI invocation also failed. |

### Unsupported

The first group was implemented long enough to obtain bounded live evidence, then removed from the built-in catalog because the successful OpenCLI path requires DOM extraction, page navigation, in-page JavaScript, or WAF runtime. The evidence is retained here; no unsupported probe code or installed adapter is retained.

| OpenCLI adapter | Evidence-backed reason |
| --- | --- |
| `51job` | E2E received WAF HTML instead of JSON. OpenCLI passed only through page navigation, WAF JavaScript, and in-page fetch. |
| `aibase` | Direct HTML exposed no article rows. OpenCLI passed through rendered-page DOM extraction. |
| `baidu-scholar` | E2E returned zero rows. OpenCLI passed through rendered/verification-cleared page DOM. |
| `brave` | Direct HTML returned no parsed rows. OpenCLI passed through rendered-page DOM extraction. |
| `cnki` | Direct overseas CNKI fetch returned HTTP 404. OpenCLI passed after page navigation and DOM extraction. |
| `gitee` | Direct Explore fetch returned HTTP 405. OpenCLI passed through page navigation/DOM extraction. |
| `gov-policy` | Direct HTML exposed no policy rows. OpenCLI passed only after the rendered listing mounted. |
| `smzdm` | Direct HTML exposed no deal rows. OpenCLI passed through page navigation/DOM extraction. |
| `yahoo` | Direct search HTML returned no rows. OpenCLI passed through rendered-page DOM extraction. |

#### Deferred DOM/page and model-session sources

| OpenCLI adapter | Evidence-backed reason |
| --- | --- |
| `1688` | `clis/1688` uses page navigation/DOM extraction and signed e-commerce page state. |
| `amazon` | `clis/amazon` uses storefront page DOM, pagination, and region/session state. |
| `band` | `clis/band` requires authenticated page/session state and DOM extraction. |
| `chaoxing` | `clis/chaoxing` requires authenticated page navigation and page-context requests. |
| `chatgpt` | `clis/chatgpt` is an authenticated streaming/model-agent web workflow, not a stable public fetch command. |
| `claude` | `clis/claude` requires authenticated model-agent session state and streaming page behavior. |
| `coupang` | `clis/coupang` extracts storefront page content and region/session state. |
| `deepseek` | `clis/deepseek` requires authenticated model-agent streaming and CSRF/session state. |
| `dianping` | `clis/dianping` uses dynamic page DOM and location/session state. |
| `doubao` | `clis/doubao` is an authenticated web model-agent workflow with streaming page state. |
| `douyin` | `clis/douyin` uses dynamic page extraction and signed/session-bound requests. |
| `facebook` | `clis/facebook` requires authenticated social page state and DOM extraction. |
| `geogebra` | `clis/geogebra` uses interactive page state and DOM/page JavaScript. |
| `gemini` | `clis/gemini` requires authenticated model-agent streaming and page/session state. |
| `gov-law` | `clis/gov-law` uses government search page navigation and DOM extraction. |
| `grok` | `clis/grok` requires authenticated model-agent session and streaming page state. |
| `hltv` | `clis/hltv` extracts dynamic match/news page content. |
| `imdb` | `clis/imdb` relies on page extraction and dynamic title/search state. |
| `indeed` | `clis/indeed` uses job-result page DOM and region/session state. |
| `jd` | `clis/jd` uses storefront page DOM, signed requests, and session state. |
| `jianyu` | `clis/jianyu` uses page navigation and dynamic content extraction. |
| `jike` | `clis/jike` requires authenticated social session and page-context requests. |
| `jimeng` | `clis/jimeng` is an authenticated model-agent workflow with page/streaming state. |
| `ke` | `clis/ke` uses dynamic listing page DOM and location/session state. |
| `kimi` | `clis/kimi` requires authenticated model-agent streaming and page/session state. |
| `linkedin` | `clis/linkedin` requires authenticated social page state and DOM extraction. |
| `manus` | `clis/manus` is an authenticated model-agent workflow with dynamic page state. |
| `mercury` | `clis/mercury` uses a logged-in finance web app and local receipt/reimbursement workflows. |
| `midjourney` | `clis/midjourney` requires authenticated model-agent/session state and dynamic page operations. |
| `mubu` | `clis/mubu` uses authenticated document page DOM and in-page state. |
| `notebooklm` | `clis/notebooklm` requires authenticated model-agent workspace state and page-context operations. |
| `ones` | `clis/ones` performs authenticated in-page API calls and may use browser cookies or `ONES_AUTH_TOKEN` depending on deployment. Only a future browser-session path is eligible; token configuration is intentionally unsupported. |
| `pinterest` | `clis/pinterest` uses authenticated/dynamic page extraction. |
| `qwen` | `clis/qwen` requires authenticated model-agent streaming and page/session state. |
| `rednote` | `clis/rednote` uses authenticated social page state and signed/dynamic requests. |
| `slock` | `clis/slock` requires authenticated page context, local-file attachment flows, and mutating operations. |
| `suno` | `clis/suno` requires authenticated model/media generation session state. |
| `taobao` | `clis/taobao` uses storefront DOM, signed requests, and authenticated session state. |
| `tdx` | `clis/tdx` uses dynamic page data and session-dependent market state. |
| `tiktok` | `clis/tiktok` relies on dynamic page extraction and signed/session-bound requests. |
| `twitter` | `clis/twitter` requires authenticated social page state, dynamic extraction, and write/download workflows. |
| `upwork` | `clis/upwork` requires authenticated marketplace page state and DOM extraction. |
| `web` | `clis/web` is a browser/page extraction workflow rather than a validated stable public HTTP adapter. |
| `wechat-channels` | `clis/wechat-channels` requires authenticated dynamic page state and media/session operations. |
| `weixin` | `clis/weixin` uses authenticated page/search state and dynamic extraction. |
| `xianyu` | `clis/xianyu` uses authenticated marketplace page state and signed/dynamic requests. |
| `xiaoe` | `clis/xiaoe` requires authenticated course page state and dynamic extraction. |
| `xiaohongshu` | `clis/xiaohongshu` requires authenticated social page state, signed requests, and media/download workflows. |
| `youdao` | `clis/youdao` uses dynamic page extraction and authenticated/session state. |
| `youtube` | `clis/youtube` uses page navigation, authentication/CSRF, and media/session workflows. |
| `yuanbao` | `clis/yuanbao` requires authenticated model-agent streaming and page/session state. |
| `zlibrary` | `clis/zlibrary` uses authenticated page state and region/WAF-sensitive access. |

#### Desktop, local-state, key, and file boundaries

These source adapters are not ordinary websites that can be completed by the current browser-backed fetch adapter contract, or they require local credentials/files that the contract intentionally does not import.

| OpenCLI adapter | Concrete source evidence | Why the current boundary cannot complete it |
| --- | --- | --- |
| `antigravity` | `clis/antigravity/SKILL.md`, `storage.js`, and `serve.js` use a local Antigravity Electron app, CDP, and `~/Library/Application Support/Antigravity`. | Requires desktop process/CDP and local application state. |
| `chatgpt-app` | `clis/chatgpt-app/new.js` and `status.js` use macOS `osascript`/Accessibility APIs against the ChatGPT Desktop App. | Requires native desktop automation, not a site fetch. |
| `chatwise` | `clis/chatwise/new.js`, `status.js`, and `screenshot.js` use the shared desktop-command surface and app DOM. | Requires desktop application control and page-context extraction. |
| `codex` | `clis/codex` uses shared desktop commands and explicitly targets Codex Desktop conversations/models. | Requires desktop application control and local app state. |
| `confluence` | `clis/_atlassian/shared.js` requires an Atlassian API token, PAT, OAuth bearer token, or username/password plus private deployment configuration. | Requires user-managed credentials, which Panerelay site adapters intentionally do not accept. |
| `cursor` | `clis/cursor` uses shared desktop commands for the Cursor app and its conversation UI. | Requires desktop application control and app DOM. |
| `discord-app` | `clis/discord-app/status.js` describes an active CDP connection to Discord Desktop; message commands extract the app UI. | Requires a native/desktop app session and DOM control. |
| `doubao-app` | `clis/doubao-app/utils.js` identifies an Electron + CDP desktop app; commands read/send through its renderer. | Requires desktop CDP and model-agent session state. |
| `jira` | `clis/_atlassian/shared.js` requires an Atlassian API token, PAT, OAuth bearer token, or username/password plus private deployment configuration. | Requires user-managed credentials, which Panerelay site adapters intentionally do not accept. |
| `rest-countries` | Current v1-v4 endpoints redirect to deprecation guidance and the supported v5 API requires a caller-supplied Bearer key. | Requires a user-managed API key. The earlier anonymous built-in was removed instead of importing or embedding a key. |
| `qoder` | `clis/qoder/_utils.js` identifies Qoder as an Electron-based AI IDE and builds renderer evaluation scripts. | Requires desktop CDP and model-agent app state. |
| `spotify` | `clis/spotify/spotify.js` requires `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`, a local token file, OAuth callback, and playback control. | Requires imported OAuth secrets/local token persistence and stateful playback control. |
| `trae-cn` | `clis/trae-cn/setup.js` and `targets.js` require a local Trae CN CDP endpoint and renderer target; commands use page evaluation and app actions. | Requires a local desktop app/CDP endpoint. |
| `trae-solo` | `clis/trae-solo/_fs.js` and `_state.js` read `~/Library/Application Support/TRAE SOLO`; renderer commands use CDP. | Requires desktop app state, local files, and CDP. |
| `weread-official` | `clis/weread-official/utils.js` refuses every command without a manually exported `WEREAD_API_KEY`. | Requires a user-managed API key, which Panerelay site adapters intentionally do not accept. |
| `xiaoyuzhou` | `clis/xiaoyuzhou/auth.js` reads/refreshes `~/.opencli/xiaoyuzhou.json`; download/transcript commands write local media/text files. | Requires local bearer credentials and file-download/write semantics. |

## Per-site E2E evidence

The isolated selector is:

```bash
PANERELAY_RUN_SITE_E2E=1 PANERELAY_E2E_SITES=<site> \
  pnpm --filter @panerelay/sites e2e
```

The completed pass ran every initial built-in as a separate process. The 109-adapter baseline produced 67 successful sites and 42 sites requiring diagnosis. A first isolated rerun recovered 15 transient upstream failures, one Flomo case reached its expected missing-exact-origin-tab blocker, and the remaining failures were repaired or classified from bounded evidence. `rest-countries` was removed under the no-user-key policy, and 9 confirmed DOM/WAF probes remain removed after classification. The current catalog therefore has 99 built-ins and 137 registered representative cases. A disabled live-gate run confirms every current built-in still owns at least one case. After canonical numeric-leading IDs were enabled, isolated `12306/stations` and `36kr/news` runs passed again through the installed CLI on 2026-08-10. After the user completed a Cloudflare check in the selected browser, isolated `1point3acres/hot` also passed through browser-cookie reuse without Panerelay navigating or executing the challenge. Cases validate structured fields and typed failure classes only; no response bodies, cookies, storage values, credentials, screenshots, or browser identifiers are retained.

| Final site outcome | Count | Per-site result |
| --- | --: | --- |
| Supported | 92 | `12306`, `1point3acres`, `36kr`, `apple-podcasts`, `archive`, `arxiv`, `autohome`, `barchart`, `bbc`, `bilibili`, `binance`, `bluesky`, `boss`, `chess`, `coingecko`, `crates`, `ctrip`, `dblp`, `defillama`, `devto`, `dictionary`, `dockerhub`, `dongchedi`, `douban`, `duckduckgo`, `eastmoney`, `endoflife`, `flathub`, `github`, `github-trending`, `google`, `google-scholar`, `goproxy`, `guazi`, `hackernews`, `hf`, `homebrew`, `hupu`, `instagram`, `juejin`, `lesswrong`, `lichess`, `linux-do`, `lobsters`, `maimai`, `maven`, `mdn`, `medium`, `nowcoder`, `npm`, `nuget`, `nvd`, `oeis`, `openalex`, `openfda`, `openreview`, `osv`, `packagist`, `paperreview`, `pixiv`, `powerchina`, `producthunt`, `pubmed`, `pypi`, `quark`, `reddit`, `reuters`, `rfc`, `rubygems`, `semanticscholar`, `sinablog`, `sinafinance`, `stackoverflow`, `steam`, `substack`, `ths`, `tieba`, `toutiao`, `trip`, `tvmaze`, `v2ex`, `wanfang`, `weibo`, `weread`, `wikidata`, `wikipedia`, `wttr`, `xueqiu`, `yahoo-finance`, `yollomi`, `zhihu`, `zsxq`; each has successful isolated live evidence. |
| Pending | 7 | `bloomberg`: representative RSS requests time out; `booking`: verification page; `flomo`: no already-open signed-in exact-origin tab; `huodongxing`: current upstream failure/empty result; `linkedin-learning`: current login/empty-result condition; `uisdc`: selector/shape drift; `uiverse`: non-JSON sample response. Each condition is represented by an expected typed E2E blocker rather than an unclassified failure. |
| Removed Unsupported probes | 9 | `51job`, `aibase`, `baidu-scholar`, `brave`, `cnki`, `gitee`, `gov-policy`, `smzdm`, `yahoo`; each isolated case reached its expected challenge or `unsupported` classification before its adapter and E2E case were removed. |

Important repaired live cases include Bilibili's separately authorized subtitle origin, Google's canonical News locale, Guazi's canonical desktop SSR origin, OSV's site-level `--version` option, Maven's positional query, and the current Bluesky/Wikipedia output shapes. Dongchedi, Boss, Douban, Quark, ZSXQ, and Maimai were rerun after the user refreshed browser login state. Maimai now reads validated Next build metadata and calls its same-origin data endpoint; its `whoami` case passed without DOM extraction or navigation. Bilibili passed 15 representative cases, with only the sample's absent AI summary classified as an expected empty result.

The Chess.com E2E uses a stable public player and derives the game URL from its current public archive. An earlier `hikaru` stats sample returned upstream HTTP 404, so the test was corrected to `magnuscarlsen`; the adapter was not weakened to hide that failure. Some long wall-clock clusters coincided with the development machine sleeping; the actual browser, Bridge, and adapter timeout bounds remained 30, 35, and 120 seconds respectively.

## Verification analysis

The migration raises verified support from 57 to 92 sites. Of 176 OpenCLI sources, 92 are Supported, 7 are Pending, and 77 are Unsupported. The Unsupported total consists of 9 evidence-backed removed DOM/WAF probes, 52 deferred DOM/page/model-session sources, and 16 desktop/local-state/key/file-boundary sources. The installed catalog contains only the 92 Supported and 7 Pending sites.

The highest-impact remaining boundary is rendered page or WAF execution: Panerelay does not perform DOM extraction, page navigation, challenge JavaScript, hydrated framework state, or in-page calls. A challenge completed manually by the user can still produce reusable browser cookies, as the 1point3acres result demonstrates, but sites that require ongoing page/WAF execution remain intentionally Unsupported for this migration. The next broad class is desktop/native/model-session behavior, followed by user-managed API keys, OAuth/token files, and local transfer workflows; these are also intentionally Unsupported. The seven Pending sites are narrower current-state issues rather than missing generic Fetch powers: upstream timeouts/errors, verification responses, one absent exact-origin login tab, and response-shape drift.

The Panerelay setup doctor reported the Extension connected and the browser-fetch path passed all successful cases. The current implementation routes requests through `SiteCommandContext.fetch`, applies browser Cookie state inside the Extension, uses fixed manifest-owned Cookie or exact-origin `localStorage` bindings where needed, rejects redirects, and fails closed on authentication/challenge responses. Browser state and selected binding values never become adapter arguments or normal output.

The strict v3 capability extension was verified in package tests and a matching reloaded daily Chrome profile on 2026-08-10. Coverage includes manifest-owned origins, protected Cookie and exact-origin `localStorage` bindings, universal redirect rejection, Cookie write-back, explicit no-cookie removal, secret redaction, Extension cancellation/session cleanup, no-follow file identity checks, multipart bounds, GBK/Base64 decoding, typed errors, and E2E authentication metadata. A real stdio MCP call also traversed Browser Registry, Bridge, and the reloaded Extension successfully. Manifest `profile`, invocation `profile`, session `adapterProfile`, request `credentialBindings`, and redirect-mode metadata are rejected explicitly; the CLI exposes no profile store, `profiles` command, or `--profile`. Optional environment API keys are not imported, and the key-dependent `rest-countries` adapter was removed.

These additions do not make DOM extraction, page navigation, WAF/CAPTCHA execution, interactive OAuth/refresh-token lifecycle, streaming model sessions, or desktop application control fetch-expressible. Browser `localStorage` is supported only through a protected exact-origin manifest binding and an already-open matching tab; arbitrary storage reads and `sessionStorage` remain unsupported. User-managed keys and tokens remain intentionally Unsupported.
