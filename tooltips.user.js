// ==UserScript==
// @name         PrUn Tooltips (Modified)
// @namespace    http://tampermonkey.net/
// @version      2024-01-12_10-49
// @description  Adds FIO powered market tooltips to Prosperous Universe
// @author       Booers, based on work by Manderius (Rynx)
// @homepageURL  https://github.com/mbowersjr/PrUn_Tooltips
// @supportURL   https://github.com/mbowersjr/PrUn_Tooltips/issues
// @source       https://github.com/mbowersjr/PrUn_Tooltips
// @match        https://apex.prosperousuniverse.com/
// @grant        none
// @require      https://code.jquery.com/jquery-3.7.1.min.js#sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=
// @downloadURL  https://raw.githubusercontent.com/mbowersjr/PrUn_Tooltips/main/tooltips.user.js
// @updateURL    https://raw.githubusercontent.com/mbowersjr/PrUn_Tooltips/main/tooltips.user.js
// ==/UserScript==

let $ = jQuery;
let prices = [];
let last_update = null;
let updates_on = null;

const styles = `
.prun-tooltip-base {
	display: flex;
	pointer-events: none;
	position: absolute !important;
	font-family: "Droid Sans",sans-serif;
	font-size: 10px;
	color: #bbb;
	z-index: 100000;
}
.prun-tooltip-box {
	flex: 1 1 auto;
}
.prun-tooltip-content {
	box-sizing: border-box;
	max-height: 100%;
	max-width: 100%;
	overflow: auto;
}
.prun-tooltip-fade {
	opacity: 0;
	-webkit-transition-property: opacity;
	-moz-transition-property: opacity;
	-o-transition-property: opacity;
	-ms-transition-property: opacity;
	transition-property: opacity;
}
.prun-tooltip-fade.prun-tooltip-show {
	opacity: 1;
}
.prun-tooltip-sidetip .prun-tooltip-box {
	background: #222;
	border: 1px solid #2b485a;
	box-shadow: 0 0 5px rgba(63,162,222,.5);
	border-radius: 0;
}
.prun-tooltip-sidetip.prun-tooltip-right .prun-tooltip-box {
	margin-left: 0;
}
.prun-tooltip-sidetip .prun-tooltip-content {
	line-height: 10px;
	padding: 0;
}
.prun-tooltip-sidetip .prun-tooltip-arrow {
	overflow: hidden;
	display: none;
	position: absolute;
}
.prun-tooltip-content h1 {
	border-bottom: 1px solid #2b485a;
	background-color: rgba(63,162,222,.15);
	padding: 9px 10px 8px 10px;
	margin: 0;
	font-weight: 400;
	font-size: 12px;
}
`;


const tooltip_html = `
<div class="prun-tooltip-base prun-tooltip-sidetip prun-tooltip-right prun-tooltip-fade prun-tooltip-show">
  <div class="prun-tooltip-box" style="margin: 0px">
    <div class="prun-tooltip-content">
      <div class="PrUn_tooltip_content">
        <h1>{TITLE}</h1>
        <table class="PrUnTools_Table">
          <thead>
            <tr>
              <th></th>
              <th>AI1</th>
              <th>CI1</th>
              <th>IC1</th>
              <th>NC1</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ask</td>
              <td class="accounting-cell">{Ask.AI1}</td>
              <td class="accounting-cell">{Ask.CI1}</td>
              <td class="accounting-cell">{Ask.IC1}</td>
              <td class="accounting-cell">{Ask.NC1}</td>
            </tr>
            <tr>
              <td>Bid</td>
              <td class="accounting-cell">{Buy.AI1}</td>
              <td class="accounting-cell">{Buy.CI1}</td>
              <td class="accounting-cell">{Buy.IC1}</td>
              <td class="accounting-cell">{Buy.NC1}</td>
            </tr>
            <tr>
              <td>Average</td>
              <td class="accounting-cell">{Avg.AI1}</td>
              <td class="accounting-cell">{Avg.CI1}</td>
              <td class="accounting-cell">{Avg.IC1}</td>
              <td class="accounting-cell">{Avg.NC1}</td>
            </tr>
            <tr class="top-border-cell">
              <td>Supply</td>
              <td class="accounting-cell">{Supply.AI1}</td>
              <td class="accounting-cell">{Supply.CI1}</td>
              <td class="accounting-cell">{Supply.IC1}</td>
              <td class="accounting-cell">{Supply.NC1}</td>
            </tr>
            <tr>
              <td>Demand</td>
              <td class="accounting-cell">{Demand.AI1}</td>
              <td class="accounting-cell">{Demand.CI1}</td>
              <td class="accounting-cell">{Demand.IC1}</td>
              <td class="accounting-cell">{Demand.NC1}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bottom-border-cell">
              <td colspan="5">Updates on {UPDATE}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</div>
`;

const tooltip_html_nodata = `
<div class="prun-tooltip-base prun-tooltip-sidetip prun-tooltip-right prun-tooltip-fade prun-tooltip-show">
  <div class="prun-tooltip-box" style="margin: 0px">
    <div class="prun-tooltip-content">
      <div class="PrUn_tooltip_content">
        <h1>{TITLE}</h1>
      </div>
    </div>
  </div>
</div>
`;

function getPrices(callback) {
    // Check if now is past the updates_on
    if (last_update && new Date() > updates_on) {
        callback(prices);
        return;
    }

    // Get market data from FIO
    $.ajax({
        type: "GET",
        url: "https://rest.fnar.net/exchange/all",
        success: function (output, status, xhr) {
            // Grab data
            prices = output;
            // Set last update to now
            last_update = new Date();
            // Set updates_on to 5 minutes from now
            updates_on = new Date(last_update.getTime() + 5 * 60000);

            callback(output);
        },
        error: function () {
            console.log("Error in API call");
        }
    });
}

function generateTooltipContent(ticker, title) {
    // Find Material in FIO data
    let market_data = prices.filter((obj) => obj.MaterialTicker === ticker);

    if (market_data.length === 0) {
        return $(tooltip_html_nodata.replace("{TITLE}", title));
    }

    let html = tooltip_html.replace("{UPDATE}", updates_on.toLocaleString());

    // Filter should return all 4 markets worth of data, populate our tooltip
    market_data.forEach((ticker_data) => {
        html = html.replace(
            `{Ask.${ticker_data.ExchangeCode}}`,
            ticker_data.Ask ? ticker_data.Ask.toLocaleString() : "null"
        );
        html = html.replace(
            `{Buy.${ticker_data.ExchangeCode}}`,
            ticker_data.Bid ? ticker_data.Bid.toLocaleString() : "null"
        );
        html = html.replace(
            `{Avg.${ticker_data.ExchangeCode}}`,
            ticker_data.PriceAverage ? ticker_data.PriceAverage.toLocaleString() : "null"
        );
        html = html.replace(
            `{Supply.${ticker_data.ExchangeCode}}`,
            ticker_data.Supply ? ticker_data.Supply.toLocaleString() : "null"
        );
        html = html.replace(
            `{Demand.${ticker_data.ExchangeCode}}`,
            ticker_data.Demand ? ticker_data.Demand.toLocaleString() : "null"
        );
        html = html.replace(`{TITLE}`, title);
    });

    // Replace any nulls with '--'
    html = html.replaceAll("null", "--");

    return $(html).attr("id", `tooltip_${ticker}`);;
}

function showTooltip(item, ticker) {
    let existing = $(`#tooltip_${ticker}`);
    if (existing.length > 0) {
        return existing;
    }

    const title = $(item).parent().attr("title");
    const content = generateTooltipContent(ticker, title);

    // Positioning
    $("body").append(content);

    let contentElem = $(content).get(0);
    let itemElem = $(item).get(0);

    const positionFromLeft = itemElem.getBoundingClientRect().right + itemElem.offsetWidth / 6;
    const canFitOnRight = positionFromLeft + contentElem.offsetWidth < window.innerWidth;
    if (canFitOnRight) {
        contentElem.style.left = positionFromLeft + "px";
    }
    else {
        contentElem.style.left = itemElem.getBoundingClientRect().left - itemElem.offsetWidth / 6 - contentElem.offsetWidth + "px";
    }

    let positionFromTop = itemElem.getBoundingClientRect().top + itemElem.offsetHeight / 2 - contentElem.offsetHeight / 2;
    const doesBottomOverflow = positionFromTop + contentElem.offsetHeight > window.innerHeight;
    const doesTopOverflow = positionFromTop < 0;

    if (doesBottomOverflow) {
        contentElem.style.top = window.innerHeight - contentElem.offsetHeight - 3 + "px";
    }
    else if (doesTopOverflow) {
        contentElem.style.top = "3px";
    }
    else {
        contentElem.style.top = positionFromTop + "px";
    }

    return content;
}

function hideTooltip(tooltip) {
    $(tooltip).remove();
}

function bindEventListeners() {
    const insideFrameSelector = ".ColoredIcon__container___djaR4r2";

    // $(insideFrameSelector).attr("title", "");

    let tooltip;
    let openTimer, closeTimer;
    const showDelay = 500, hideDelay = 500;

    $("body").on("mouseenter", insideFrameSelector, (event) => {
        if (!event.shiftKey) return;

        let thisItem = $(event.target);
        let ticker = $(".ColoredIcon__label___OU1I4oP", thisItem).text();

        clearTimeout(closeTimer);
        $(tooltip).remove();

        openTimer = setTimeout(() => {
            tooltip = showTooltip(thisItem, ticker);
        }, showDelay);
    });

    $("body").on("mouseleave", insideFrameSelector, (event) => {
        clearTimeout(openTimer);

        closeTimer = setTimeout(() => {
            $(tooltip).remove();
        }, hideDelay);
    });
}

function setupTooltips() {
    getPrices(() => bindEventListeners());
}

function monitorOnElementCreated(selector, callback, onlyOnce = true) {
    const getElementsFromNodes = (nodes) =>
        Array.from(nodes)
            .flatMap((node) =>
                node.nodeType === 3
                    ? null
                    : Array.from(node.querySelectorAll(selector))
            )
            .filter((item) => item !== null);
    let onMutationsObserved = function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.addedNodes.length) {
                const elements = getElementsFromNodes(mutation.addedNodes);
                if (elements && elements.length > 0) {
                    if (onlyOnce) {
                        observer.disconnect();
                        callback(elements[0]);
                        return;
                    }
                    callback(elements);
                }
            }
        });
    };

    let containerSelector = "body";
    let target = document.querySelector(containerSelector);
    let config = { childList: true, subtree: true };
    let MutationObserver =
        window.MutationObserver || window.WebKitMutationObserver;
    let observer = new MutationObserver(onMutationsObserved);
    observer.observe(target, config);
}

function addStyle(styleString) {
    var style = document.createElement("style");
    if (style.styleSheet) {
        style.styleSheet.cssText = styleString;
    } else {
        style.appendChild(document.createTextNode(styleString));
    }
    document.getElementsByTagName("head")[0].appendChild(style);
}

function waitForApexLoad() {
    setupTooltips();

    const onLoad = () => {
        addStyle(styles);
    };

    const selector = "#TOUR_TARGET_BUTTON_BUFFER_NEW";
    monitorOnElementCreated(selector, onLoad);
}

(function () {
    "use strict";
    waitForApexLoad();
})();
