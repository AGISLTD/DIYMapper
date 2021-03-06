// http://stackoverflow.com/questions/1199352/smart-way-to-shorten-long-strings-with-javascript
function truncate( n, useWordBoundary ){
    var isTooLong = this.length > n,
        s_ = isTooLong ? this.substr(0,n-1) : this;
        s_ = (useWordBoundary && isTooLong) ? s_.substr(0,s_.lastIndexOf(' ')) : s_;
    return  isTooLong ? s_ + '&hellip;' : s_;
};

function request(type){
    document.getElementById('request-form').style.display='block';
    $('#requestformtype').val(type);
    $('#requestformuser').val(firebase.auth().currentUser.email);
}

function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
}

function getEmail(){
    var email = $("#email").val();
    if (email.indexOf('@') == -1){ // Not an email address. Assume they're entering a Username only
        email = email+'@agis.co.nz';
    }
    return email;
}

function getLogo(logo){
    var content = "<img class=\"w3-left logo\" src=\"images/"
    switch (logo){
        case ("aucklandcouncil") :
            content += "ac_web_app_log.png";
            break;
        case ("agis") :
            content += "agis_banner_logo.png";
            break;
        case ("exigent") :
            content += "exigent_logo.png";
            break;
    }
    return content += "\">";
    
}

function forgotPassword(){
    firebase.auth().sendPasswordResetEmail(getEmail()).then(function(){
        $('#forgotPasswordStatus').css({'color':'green'});
        $('#forgotPasswordStatus').text("Password reset email sent - please check your emails");
    }).catch (function(error) {
        $('#forgotPasswordStatus').css({'color':'red'});
        $('#forgotPasswordStatus').text("Failed to reset password")
    });
}

function downloadGeoJson(jsonguid, filename){
    rootRef.ref('/geojson/'+jsonguid).once('value', function(snap){
      var blob = new Blob([JSON.stringify(snap.val())], {type : 'application/json'});
      var evt = document.createEvent("HTMLEvents");
      $("<a>", {
        download: filename,
        href: URL.createObjectURL(blob)
      }).get(0).click();
    });
}

function downloadEdit(location,editguid){
    rootRef.ref('edit/'+location+'/'+editguid+'/geojsonid').once('value', function(snapshot){
        downloadGeoJson(snapshot.val(), "DIYMapper-Data.geojson");
    })
}