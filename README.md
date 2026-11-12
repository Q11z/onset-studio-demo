# ONSET · Boutique Gym Operations Management

[Open the live demo](https://q11z.github.io/onset-studio-demo/)

A studio operations project covering member onboarding, class booking, coach confirmation, and session settlement. The original application runs as a WeChat Mini Program and has been released as a trial version. This repository presents an interactive browser demo with English as the default language and a Simplified Chinese option.

**Role** · Independent developer with AI-assisted implementation and iteration.

## 1. Project Background

Personal-training studios need to coordinate coach availability, member bookings, prepaid session balances, and membership validity. When these activities rely on separate conversations and manual updates, staff must repeatedly reconcile who booked a slot, whether a coach confirmed it, whether a class took place, and how many sessions remain.

This project addresses three operational needs.

- Give members and coaches a shared booking status, reducing repeated availability checks and confirmation messages.
- Bring pending bookings, unsettled classes, membership requests, and low balances into a coach workbench.
- Connect class completion to member confirmation and a session-balance update, making the deduction visible to both sides.

The core workflow is expressed through explicit scheduling states.

```text
Open slot -> Booking requested -> Coach confirmed -> Settlement requested -> Member confirmed
   open          pending             confirmed          waiting_client          completed
```

## 2. Technical Implementation

### WeChat Application and Web Demo

| Layer | Original WeChat application | Browser demo in this repository |
| --- | --- | --- |
| Runtime | WeChat Mini Program | Standard web browser, hosted on GitHub Pages |
| Interface | Native WXML, WXSS, and JavaScript pages | Exported page templates, styles, and logic, rendered through a browser compatibility layer |
| Data | CloudBase collections for coaches, clients, schedules, and messages | Seeded records, an in-browser database adapter, and localStorage |
| Identity | OpenID-based coach lookup and page access checks | A simulated account for exploring both member and coach workflows |
| Server operations | Cloud functions for notifications, membership approval, and scheduled validity deductions | Local callbacks and simulated database operations |
| Notifications | In-app records and WeChat subscription-message APIs | In-app demo records and simulated subscription callbacks |
| Language | Original Chinese page source | English and Chinese presentation dictionaries, with a saved language preference |

In the original application, `coaches` holds coach profiles and display names. Member records live in `clients`, bookings and settlement states in `schedules`, and in-app notifications in `messages`. New scheduling records carry coach ownership identifiers to support separate coach workspaces.

The original cloud functions cover distinct operations.

- `classReminder` resolves the caller's OpenID, checks coach identity, and scans for classes starting approximately one hour later.
- `sendNotice` handles coach/member subscription notifications and coach-originated in-app messages, with caller and member-ownership checks.
- `coachAdmin` validates coach access before approving or dismissing membership applications.
- `dailyDeduct` reduces membership validity daily and clears remaining sessions when validity reaches zero.

The browser demo reuses the exported mini-program page code through four small modules. The template renderer converts WXML bindings and WXSS units for the browser. The runtime adapts page lifecycles, navigation, dialogs, and canvas calls. The data adapter provides simulated CloudBase operations. The translation layer changes presentation text while preserving entered names, notes, and messages.

| File | Responsibility |
| --- | --- |
| [native-pages.js](native-pages.js) | Generated snapshot of the five mini-program pages and their styles |
| [wxml.js](wxml.js) | WXML rendering, data binding, event metadata, and WXSS unit conversion |
| [demo.js](demo.js) | Browser runtime, page navigation, dialogs, and mini-program API adapters |
| [demo-cloud.js](demo-cloud.js) | Simulated database operations, cloud-function callbacks, and sample records |
| [i18n.js](i18n.js) | English/Chinese UI text and persisted language selection |

Each visitor's demo records are stored in that browser. Cloud jobs, real WeChat authentication, and subscription-message delivery belong to the original WeChat deployment. The browser demo supports inspection of the interface and operational workflows using simulated data.

### AI-Assisted Development

AI coding assistance was used during implementation and iterative debugging of the member and coach interfaces, nickname synchronization, booking rules, session settlement, notification cloud functions, and access checks. It also helped create the browser renderer and simulated data layer, add bilingual presentation, run syntax and programmatic workflow checks, and publish the demo through GitHub Pages.

Development proceeded through concrete requirements and feedback, including correcting avatar sizing, restoring mobile layouts, refining name display rules, and distinguishing member actions from coach actions. This repository reflects that AI-assisted implementation process.

## 3. Business Value

| Operational need | Implemented mechanism | Intended benefit |
| --- | --- | --- |
| Reduce manual coordination | Members request bookings, coaches confirm them, and both views display the resulting status. Pending and unsettled work is grouped in the coach workbench. | Fewer repeated status checks and clearer ownership of the next action |
| Reduce scheduling conflicts | Availability filtering hides open slots within 60 minutes of an occupied start time and closes availability within 30 minutes of class start. | Fewer overlapping options presented during booking |
| Improve session-record clarity | Coaches request settlement, members confirm attendance, and the system updates the balance and completed-class history. | Less reliance on separately maintained session counts and a clearer basis for reviewing deductions |
| Keep membership balances usable | Booking checks reject zero-session balances. Validity-expiry logic clears remaining sessions when a membership expires. | More consistent application of booking eligibility rules |
| Organize member follow-up | Membership requests, low-balance indicators, in-app messages, nutrition logs, and weight history are available within the two workflows. | Less information scattered across separate conversations and records |

The booking-to-settlement flow, balance update, and bilingual switching have been exercised with programmatic integration checks in the browser demo. Business impact is described through the implemented workflows. Time savings, booking-conflict rates, and record-error reductions remain unmeasured.

## Explore the Demo

1. Open **Book a class**, choose an available slot, and submit a booking.
2. Open **My classes**, scroll to **Switch to coach view**, and confirm the same booking on its scheduled date.
3. Select **Settle class**, choose the training content, and send the settlement request.
4. Return to the student view and confirm attendance in **My classes** to see the balance and training history update.

The demo also includes member approval, messaging, nutrition logging, and weight history. Use the language menu above the app to switch between English and Chinese. **Reset demo** restores the initial sample data.

## Run Locally

Open `index.html` in a browser. The demo consists of static HTML, CSS, JavaScript, and image files. GitHub Pages publishes the root of the `main` branch.

## 中文概要

### 项目背景

项目围绕健身工作室的预约协调、待办跟进和课时核对场景设计。将学员预约、教练确认、下课结算与学员确认串成明确流程，让双方能在系统里查看当前状态。

### 技术实现与 AI 辅助

原项目使用微信小程序原生 WXML、WXSS、JavaScript 与 CloudBase，包含云数据库、云存储和通知、审批、定时扣减有效期等云函数。当前仓库提供网页版演示，复用原页面模板、样式和逻辑，通过浏览器适配层与本地模拟数据展示双端流程，并支持中英文切换。

开发过程中实际使用 AI 辅助完成了页面实现、布局调试、昵称同步、预约与结算逻辑、通知与身份校验相关代码，以及 Web Demo 适配、翻译和验证。

### 业务价值

共享预约状态和待办聚合旨在减少人工来回确认。时间冲突过滤旨在减少重叠时段的展示。双向结算、余额更新和训练历史让课时扣减更清晰。目前尚未量化节省时间、冲突率变化或记录错误率变化，相关效果以已实现的流程机制说明。
