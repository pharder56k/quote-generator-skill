/**
 * Handlebars 自定义助手函数
 * 在 render.js 中注册使用
 */

export function registerHelpers(Handlebars) {
  // 格式化货币
  Handlebars.registerHelper("formatCurrency", (value) => {
    if (typeof value !== "number") return value;
    return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
  });

  // 条件：值大于 0
  Handlebars.registerHelper("gt", (a, b) => a > b);

  // 自增序号（用于模板内循环）
  Handlebars.registerHelper("inc", (value) => value + 1);

  // 换行符转 <br>
  Handlebars.registerHelper("nl2br", (text) => {
    if (!text) return "";
    return new Handlebars.SafeString(text.replace(/\n/g, "<br>"));
  });
}
