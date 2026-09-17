import { 配置 } from "./config.js";
import { 净化文本 } from "./utils.js";
import { 发布 } from "./events.js";

function 今天() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function 读签到() {
  try {
    const 原文 = localStorage.getItem(配置.签到.存储键);
    if (!原文) return { 日期: "", 连访天数: 0, 历史: {} };
    const 数据 = JSON.parse(原文);
    if (!数据 || typeof 数据 !== "object") return { 日期: "", 连访天数: 0, 历史: {} };
    return { 日期: "", 连访天数: 0, 历史: {}, ...数据 };
  } catch {
    return { 日期: "", 连访天数: 0, 历史: {} };
  }
}

function 写签到(数据) {
  try {
    localStorage.setItem(配置.签到.存储键, JSON.stringify(数据));
    return true;
  } catch {
    return false;
  }
}

export const 签到 = {
  状态() {
    const 数据 = 读签到();
    return { 今日已签: 数据.日期 === 今天(), 连访天数: 数据.连访天数 || 0 };
  },
  签() {
    const 数据 = 读签到();
    const 今 = 今天();
    if (数据.日期 === 今) return { 已签: true, 连访天数: 数据.连访天数 || 0 };
    const 昨 = new Date(Date.now() - 86400000);
    const 昨串 = `${昨.getFullYear()}-${昨.getMonth() + 1}-${昨.getDate()}`;
    const 连 = 数据.日期 === 昨串 ? (数据.连访天数 || 0) + 1 : 1;
    数据.日期 = 今;
    数据.连访天数 = 连;
    数据.历史 = { ...(数据.历史 || {}), [今]: 1 };
    写签到(数据);
    return { 已签: false, 连访天数: 连 };
  },
};

function 读黑名单() {
  try {
    const 原文 = localStorage.getItem(配置.治理.拉黑键);
    if (!原文) return [];
    const 数据 = JSON.parse(原文);
    return Array.isArray(数据) ? 数据.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function 写黑名单(表) {
  try {
    localStorage.setItem(配置.治理.拉黑键, JSON.stringify(表.slice(0, 配置.治理.上限条数 || 200)));
    return true;
  } catch {
    return false;
  }
}

function 读举报() {
  try {
    const 原文 = localStorage.getItem(配置.治理.举报键);
    if (!原文) return [];
    const 数据 = JSON.parse(原文);
    return Array.isArray(数据) ? 数据.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function 写举报(表) {
  try {
    localStorage.setItem(配置.治理.举报键, JSON.stringify(表.slice(0, 配置.治理.上限条数 || 200)));
    return true;
  } catch {
    return false;
  }
}

export const 治理 = {
  名单() {
    return 读黑名单();
  },
  在名单(昵称) {
    return 读黑名单().includes(净化文本(昵称, 配置.身份.最大长度));
  },
  拉黑(昵称) {
    const 干净 = 净化文本(昵称, 配置.身份.最大长度);
    if (!干净) return false;
    const 表 = 读黑名单();
    if (!表.includes(干净)) {
      表.push(干净);
      写黑名单(表);
    }
    return true;
  },
  取消(昵称) {
    const 干净 = 净化文本(昵称, 配置.身份.最大长度);
    写黑名单(读黑名单().filter((x) => x !== 干净));
  },
  举报(原文) {
    const 干净 = 净化文本(原文, 配置.安全.弹幕最大长度 + 配置.身份.最大长度 + 4);
    if (!干净) return false;
    const 表 = 读举报();
    表.push(干净);
    写举报(表);
    const 切 = 干净.split("：")[0].split(":")[0];
    if (切 && 切 !== 干净) this.拉黑(切);
    return true;
  },
};
