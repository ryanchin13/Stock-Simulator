// // shell for ajax form -- TODO

(function ($) {
    // initializes all popovers on the website
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        const popoverId = popoverTriggerEl.attributes['data-content-id'];
        const contentEl = $(`#${popoverId.value}`).html();
        return new bootstrap.Popover(popoverTriggerEl, {
            html: true,
            content: contentEl
        });
    });

    // Ajax request for stock quote
    var stockTable = $('#stocks');
    var modalSymbol = $('#stock-symbol');
    var modalBody = $('#stock-info');

    stockTable.on('click', 'a', function (event) {
        event.preventDefault();
        var currentSymbol = event.target.innerText; // get the symbol of the stock
        // empty the modal
        modalSymbol.empty();
        modalBody.empty();

        // setup api call with current symbol
        requestConfig = {
            method: 'GET',
            url: `https://cloud.iexapis.com/stable/stock/${currentSymbol}/quote?token=pk_f1ab256ea4ad4fe288c7066938835519` // IEX Cloud API call for a stock quote
        }

        $.ajax(requestConfig).then(function (responseMessage) { // API call returning quote data
            console.log(responseMessage);
            // populate modal with stock info
            modalSymbol.append(`${currentSymbol}`);
            modalBody.append(`<p>Latest Price: \$${responseMessage.latestPrice}</p>`);
            modalBody.append(`<p>Open: \$${responseMessage.open}</p>`);
            modalBody.append(`<p>High: \$${responseMessage.high}</p>`);
            modalBody.append(`<p>Low: \$${responseMessage.low}</p>`);
            modalBody.append(`<p>Previous Close: \$${responseMessage.previousClose}</p>`);
            modalBody.append(`<p>Volume: ${responseMessage.volume}</p>`);
            modalBody.append(`<p>52-Week High: \$${responseMessage.week52High}</p>`);
            modalBody.append(`<p>52-Week Low: \$${responseMessage.week52Low}</p>`);
        });
    });
})(window.jQuery);