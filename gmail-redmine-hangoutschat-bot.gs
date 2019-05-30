/**
* gmail未読からRedmineのメール通知を検索しpost、postしたら既読にする
* https://developers.google.com/hangouts/chat/how-tos/bots-develop#incoming
*/
function main() {
  const url = 'https://chat.googleapis.com/v1/spaces/<<your ROOM-KEY>>/messages?key=<<your API-KEY>>'
  const now = new Date();
  const todayYmd = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/M/d');
  const yesterday = new Date(now.getYear(), now.getMonth(), now.getDate() - 2);
  var yesterdayYmd = Utilities.formatDate(yesterday,'Asia/Tokyo', 'yyyy/M/d');
  const mail_filter = 'in:unread from:"<<redmine notification sender mail address>>" after:' + yesterdayYmd;
  //Logger.log(todayYmd);
  //Logger.log(yesterdayYmd);
  
  const threads = GmailApp.search(mail_filter);
  var chatMsgs = [];
  for(var i = 0; i < threads.length; i++){
    // GmailThread
    var thread = threads[i];
    // GmailApp.getMessagesForThreads(threads)を使ったら受信順にソートできるかも
    var messages = thread.getMessages();
    // thread表示をオフにしているため通常1件のみ
    // 受信の古い順にするため逆順処理
    for (var j = messages.length - 1; 0 <= j; j--) {
      var message = messages[j];
      Logger.log(message.getSubject());
      if(message.isUnread()){
        // 多重実行されることがあるようなので最初に既読にする
        thread.markRead();
        // メールタイトルにチケットタイトルが入っているためここからissueのidを特定
        var threadKey = message.getSubject();
        var issue_id = '';
        var issue_url = '<<your redmine URL>>/redmine/issues/';
        try{
          var matched = message.getSubject().match(/.*#([0-9]+)\].*/);
          if (matched != null && matched.length == 2) {
            issue_id = matched[1];
            issue_url = issue_url + issue_id;
            threadKey = 'Concierge' + issue_id;
          }else if (message.getSubject() == '【コンシェルジュ】 未対応チケット一覧') {
            threadKey = 'Concierge' + message.getId();
          }else {
            console.error({message: 'cannot specify issue_id', data:{subject:message.getSubject(),plainBody:message.getPlainBody()}});
          }
        } catch(e) {
          console.error({message: 'failed to specify issue_id', data:{subject:message.getSubject(),plainBody:message.getPlainBody()}});
        }
        var subject = '<' + issue_url + '|' + message.getSubject() + '>';
        console.log({message:'issue_id=' + issue_id + ',subject=' + message.getSubject() + ',url=' + issue_url + ',threadKey=' + threadKey, data:{subject:message.getSubject(),plainBody:message.getPlainBody()}});
        
        var plainBody = message.getPlainBody();
        var updatedPlainBody = plainBody;
        if(!/[\s\S]*説明 を更新[\s\S]*/m.test(updatedPlainBody) && !/.+\(新規\)/m.test(subject)){
          updatedPlainBody = plainBody.replace(/--------------------------------+[\s\S]*\w+ #[\d]+[\s\S]*/m, '');   
        }
        // for  "error": { "code": 400, "message": "Maximum length of the field is 4096
        updatedPlainBody = updatedPlainBody.substring(0, 2000);
        chatMsgs.push('*更新日時:' + message.getDate() + '*\n*題名:' + subject + '* \n```' + updatedPlainBody +'```');
        
        //      Logger.log('subject:' + messages[i].getSubject() + '\nbody:' + messages[i].getPlainBody());
        //      break;
        
        var fetchURL = url + '&threadKey=' + MD5(issue_url);
        chatMsgs.push("fetchURL:" + fetchURL);
        chatMsgs.push("url:" + issue_url);
        chatMsgs.push("MD5:" + MD5(issue_url));
        var botMessage = {
          'text' : chatMsgs.join('\n\n')
        }
        
        var options = {
          'method': 'POST',
          'headers' : {
            'Content-Type': 'application/json; charset=UTF-8'
          },
          'payload':JSON.stringify(botMessage)
        };
        try{
          if(!/類似チケット/.test(updatedPlainBody) && !/コンシェルジュ あい/m.test(updatedPlainBody) ) {
            // redmine AI postは除外
            UrlFetchApp.fetch(fetchURL, options);
          }
          Logger.log(botMessage);
        }catch(e){
          Logger.log(e);
          console.error(e, options)
        }
      }// isUnread
    }// for message
  } // for thread
}

/**
 * ------------------------------------------
 *   MD5 function for GAS(GoogleAppsScript)
 *
 * You can get a MD5 hash value and even a 4digit short Hash value of a string.
 * ------------------------------------------
 * Usage1:
 *   `=MD5("YourStringToHash")`
 *     or
 *   `=MD5( A1 )` with the same string at A1 cell
 *   result:
 *     `FCE7453B7462D9DE0C56AFCCFB756193`.
 *     For your sure-ness you can verify it in your terminal as below.
 *     `$ md5 -s "YourStringToHash"`
 * Usage2:
 *   `=MD5("YourStringToHash", true)` for short Hash
 *    result:
 *     `6MQH`
 *     Note that it has more conflict probability.
 *
 * How to install:
 *   Copy the scipt, pase it at [Tools]-[Script Editor]-[<YourProject>]
 *   or go https://script.google.com and paste it.
 *   For more details go:
 *     https://developers.google.com/apps-script/articles/
 * Latest version:
 *   https://gist.github.com/KEINOS/78cc23f37e55e848905fc4224483763d
 * Author:
 *   KEINOS @ https://github.com/keinos
 * Reference and thanks to:
 *   https://stackoverflow.com/questions/7994410/hash-of-a-cell-text-in-google-spreadsheet
 * ------------------------------------------
 *
 * @param {string} input The value to hash.
 * @param {boolean} isShortMode Set true for 4 digit shortend hash, else returns usual MD5 hash.
 * @return {string} The hashed input
 * @customfunction
 *
 */
function MD5( input, isShortMode )
{
    var txtHash = '';
    var rawHash = Utilities.computeDigest(
                      Utilities.DigestAlgorithm.MD5,
                      input,
                      Utilities.Charset.UTF_8 );

    var isShortMode = ( isShortMode == true ) ? true : false;
 
    if ( ! isShortMode ) {
        for ( i = 0; i < rawHash.length; i++ ) {

            var hashVal = rawHash[i];

            if ( hashVal < 0 ) {
                hashVal += 256;
            };
            if ( hashVal.toString( 16 ).length == 1 ) {
                txtHash += '0';
            };
            txtHash += hashVal.toString( 16 );
        };
    } else {
        for ( j = 0; j < 16; j += 8 ) {

            hashVal = ( rawHash[j]   + rawHash[j+1] + rawHash[j+2] + rawHash[j+3] )
                    ^ ( rawHash[j+4] + rawHash[j+5] + rawHash[j+6] + rawHash[j+7] );

            if ( hashVal < 0 ) {
                hashVal += 1024;
            };
            if ( hashVal.toString( 36 ).length == 1 ) {
                txtHash += "0";
            };

            txtHash += hashVal.toString( 36 );
        };
    };

    // change below to "txtHash.toLowerCase()" for lower case result.
    return txtHash.toUpperCase();

}

