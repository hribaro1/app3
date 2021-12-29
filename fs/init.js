load('api_config.js');
load('api_gcp.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_dht.js');
load('api_sys.js');
load('api_rpc.js');


let topicsubconfig = '/devices/' + Cfg.get('device.id') + '/config';
let topicsubcommand = '/devices/' + Cfg.get('device.id') + '/commands';
let topicsubcommandreset = '/devices/' + Cfg.get('device.id') + '/commands/reset';
let topicpubstate = '/devices/' + Cfg.get('device.id') + '/state';
let topicpubeventsfan = '/devices/' + Cfg.get('device.id') + '/events/fan';
let topicpubeventssensor = '/devices/' + Cfg.get('device.id') + '/events/sensor';

let pin = Cfg.get('app.pin');  // GPIO pin which has a DHT sensor data wire connected
let dht = DHT.create(pin, DHT.DHT21);  // Initialize DHT library
let tpublish = dht.getTemp()-5+Cfg.get('app.sen.toffset');
let hpublish = dht.getHumidity()+Cfg.get('app.sen.hoffset');
let i = 1;
let oldsentimer = Timer.set(10, false, function() {}, null);

//writes only one message to serial after time initialy defined (10s) to serial console and does not publish to IOT core until configured to user
let oldtimer = Timer.set(Cfg.get('app.sen.time'), Timer.REPEAT, function() {   
  let t = dht.getTemp()-5+Cfg.get('app.sen.toffset');
  let h = dht.getHumidity()+Cfg.get('app.sen.hoffset');
  let tm = Timer.now();
  print ("After initial time");
  print ("Temperature: ", t, '  ', "Humidity: ", h);
  if (isNaN(h) || isNaN(t)) {
    print('Failed to read data from sensor');
  } else {
    let msg = JSON.stringify({type: "sensor", userId: Cfg.get('app.user'), time: tm, temperature: t, humidity: h, oldSpeed: Cfg.get('app.old.speed'), aboveHumLimit: Cfg.get('app.hum.above'), underTempLimit: Cfg.get('app.temp.under')});
    print(topicpubstate, '->', msg);
    MQTT.pub(topicpubstate, msg, 1);
    tpublish = t;
    hpublish = h;
  }
}, null); 


MQTT.sub(topicsubconfig, function(conn, topic, msg) {
//expected coinfig JSON
//{“userId”: 0, “name”: ”my-fan”, “updateTime”: 600000, “updateValue”: 1, “limitHum1”: 75, “limitHum2”: 85, 
//  “limitTemp1”: 75, “limitTemp2”: 17, "useHumidity":"true", "useTemperature":"true", "tempOffset":5, "humOffset":0}
  let obj = JSON.parse(msg) || {};

  //zapiši nove vrednosti parametrov 
  Cfg.set({app: {user: obj.userId}});
  Cfg.set({app: {name: obj.name}});
  Cfg.set({app: {sen: {time: obj.updateTime}}});
  Cfg.set({app: {sen: {val: obj.updateValue}}});
  Cfg.set({app: {sen: {toffset: obj.tempOffset}}});
  Cfg.set({app: {sen: {hoffset: obj.humOffset}}});
  Cfg.set({app: {lim: {hum1: obj.limitHum1}}});
  Cfg.set({app: {lim: {hum2: obj.limitHum2}}});
  Cfg.set({app: {lim: {temp1: obj.limitTemp1}}});  
  Cfg.set({app: {lim: {temp2: obj.limitTemp2}}});
  Cfg.set({app: {use: {hum: obj.useHumidity}}});  
  Cfg.set({app: {use: {temp: obj.useTemperature}}});
// takoj objavi
  let t = dht.getTemp()-5+Cfg.get('app.sen.toffset');
  let h = dht.getHumidity()+Cfg.get('app.sen.hoffset');
  let tm = Timer.now();
  if (isNaN(h) || isNaN(t)) {
   print('Failed to read data from sensor');
  } else {
    // expected JSON to report value {type: "sensor", “userId”: 0, "time":"123456", “temperature”: 22, “humidity”: 45, oldSpeed: Cfg.get('app.old.speed'), aboveHumLimit: Cfg.get('app.hum.above'), underTempLimit: Cfg.get('app.temp.under')}
    let msg = JSON.stringify({type: "sensor", userId: Cfg.get('app.user'), time: tm, temperature: t, humidity: h, oldSpeed: Cfg.get('app.old.speed'), aboveHumLimit: Cfg.get('app.hum.above'), underTempLimit: Cfg.get('app.temp.under')});
    print(topicpubstate, '->', msg);
    MQTT.pub(topicpubstate, msg, 1);
  };
// konec takoj objavi
// startaj timer da pogleda vrednosti vsakih 10 s  
Timer.del(oldtimer);
  let newtimer = Timer.set(10000, Timer.REPEAT, function() {
    let t = dht.getTemp()-5+Cfg.get('app.sen.toffset');
    let h = dht.getHumidity()+Cfg.get('app.sen.hoffset');
    let tm = Timer.now();
    i=i+1;
    // objavi status če je čas za objavo glede na nastavljen updateTime
    if (i > Cfg.get('app.sen.time')/10000 ) {
      // expected JSON to report value {“userId”: 0, "time":"123456", “temperature”: 22, “humidity”: 45}
      let msg = JSON.stringify({type: "sensor", userId: Cfg.get('app.user'), time: tm, temperature: t, humidity: h, oldSpeed: Cfg.get('app.old.speed'), aboveHumLimit: Cfg.get('app.hum.above'), underTempLimit: Cfg.get('app.temp.under')});
      print(topicpubstate, '->', msg);
      MQTT.pub(topicpubstate, msg, 1);
      i = 1;
      tpublish = t;
      hpublish = h;
    }
    if ( t-tpublish > Cfg.get('app.sen.val')/10 || tpublish-t > Cfg.get('app.sen.val')/10) {
      let msg = JSON.stringify({type: "sensor", userId: Cfg.get('app.user'), time: tm, temperature: t, humidity: h, oldSpeed: Cfg.get('app.old.speed'), aboveHumLimit: Cfg.get('app.hum.above'), underTempLimit: Cfg.get('app.temp.under')});
      print(topicpubstate, '->', msg);
      MQTT.pub(topicpubstate, msg, 1);
      tpublish = t;
      hpublish = h;
    }
    if ( h-hpublish > Cfg.get('app.sen.val')/2 || hpublish-h > Cfg.get('app.sen.val')/2) {
      let msg = JSON.stringify({type: "sensor", userId: Cfg.get('app.user'), time: tm, temperature: t, humidity: h, oldSpeed: Cfg.get('app.old.speed'), aboveHumLimit: Cfg.get('app.hum.above'), underTempLimit: Cfg.get('app.temp.under')});
      print(topicpubstate, '->', msg);
      MQTT.pub(topicpubstate, msg, 1);
      tpublish = t;
      hpublish = h;
    }
    //    print ("Temperature: ", t, '  ', "Humidity: ", h, '  ', "Temperature pub: ", tpublish, '  ', "Humidity pub: ", hpublish);
  }, null);
  oldtimer = newtimer;
}, null);

/*
{"userId":"2KfF8ZeTALZnuwOl8fGc564FE3g1","name":"mysensor","updateTime":60000,"limitHum1":77,"limitHum2":88,"limitTemp1":19,"limitTemp2":17}
*/

MQTT.sub(topicsubcommand, function(conn, topic, msg) {
  // {"auto":true,"boost":false,"night":false,"summer":false,"speed":2, "boostCountDown":3600000}
      let obj = JSON.parse(msg) || {};
      Cfg.set({app: {sen: {mode: obj.auto}}});
      Cfg.set({app: {sen: {speed: obj.speed}}});    
      print ("Speed: ", obj.speed, "Auto ", obj.auto, "Boost ", obj.boost, "Night ", obj.night, "Summer ", obj.summer);  
      let speed = Cfg.get('app.sen.speed');
      let underTempLimit = Cfg.get('app.temp.under');
      let aboveHumLimit = Cfg.get('app.hum.above');
      //shrani oldSpeed v config le če sta underTemp in aboveHum oba na false
      if (!underTempLimit && !aboveHumLimit){
        Cfg.set({app: {old: {speed: speed}}});  
      };
      let temp = dht.getTemp()-5+Cfg.get('app.sen.toffset');
      let hum = dht.getHumidity()+Cfg.get('app.sen.hoffset');
      let tm = Timer.now();
      if (Cfg.get('app.sen.mode')){
        let underTempLimit = false;
        let aboveHumLimit = false;
        if ( temp < Cfg.get('app.lim.temp1') && Cfg.get('app.use.temp')){
          underTempLimit = true;
          if (temp < Cfg.get('app.lim.temp2')) {
            speed = 1;
            print ("1.Hitrost1 pod temp2: ", speed);
          }else{
            speed = 2;
            print ("1.Hitrost1 pod temp1: ", speed);
          }
        }else{
          if ( hum > Cfg.get('app.lim.hum1') && Cfg.get('app.use.hum')) {
            aboveHumLimit = true;
            if (hum > Cfg.get('app.lim.hum2')) {
              speed = 4;
              print ("1.Hitrost1 pod hum21: ", speed);
            }else{
              speed = 3;
              print ("1.Hitrost1 pod hum1: ", speed);
            }
          }  
        };
        // Objavi če je sprememba na underTemp ali aboveHUm
        if (aboveHumLimit !== Cfg.get('app.hum.above') || underTempLimit !== Cfg.get('app.temp.under')) {
          print ("Objavi če je sprememba na underTemp, aboveHUm");
          let msg = JSON.stringify({type: "sensor", userId: Cfg.get('app.user'), time: tm, temperature: temp, humidity: hum, oldSpeed: Cfg.get('app.old.speed'), aboveHumLimit: Cfg.get('app.hum.above'), underTempLimit: Cfg.get('app.temp.under')});
          print(topicpubstate, '->', msg);
          MQTT.pub(topicpubstate, msg, 1);
          //ce je sprememba meja in sta oba false potem objavi oz. spremeni speed nazaj na oldspeed
          if(!aboveHumLimit && !underTempLimit) {
            print ("Hitrost nazaj na oldSpeed: ", Cfg.get('app.old.speed'));
            let msg = JSON.stringify({userId: Cfg.get('app.user'), boost: false, speed: Cfg.get('app.old.speed')});
            print(topicpubeventsfan, '->', msg);
            MQTT.pub(topicpubeventsfan, msg, 1);
          } 
        };

        Cfg.set({app: {hum: {above: aboveHumLimit}}});
        Cfg.set({app: {temp: {under: underTempLimit}}});
        
        // če je evaluirana hitrost drugačna kot je bila poslana s strežnika potem popravi hitrost na bazi
        if (speed !== Cfg.get('app.sen.speed')) {
          print ("Hitrost prvic, ki se objavi na events/fan: ", speed);
          let msg = JSON.stringify({userId: Cfg.get('app.user'), speed: speed});
          print(topicpubeventsfan, '->', msg);
          MQTT.pub(topicpubeventsfan, msg, 1);
        }


        // če je auto=false postaviš fane na oldspeed --> spremeniš nazaj hitrost
 
      };  
  
    Timer.del(oldsentimer);  

    let newsentimer = Timer.set(10000, Timer.REPEAT, function() {
      let speed = Cfg.get('app.sen.speed');
      let underTempLimit = Cfg.get('app.temp.under');
      let aboveHumLimit = Cfg.get('app.hum.above');
      //shrani oldSpeed v config le če sta underTemp in aboveHum oba na false
      if (!underTempLimit && !aboveHumLimit){
        Cfg.set({app: {old: {speed: speed}}});  
      };
      let temp = dht.getTemp()-5+Cfg.get('app.sen.toffset');
      let hum = dht.getHumidity()+Cfg.get('app.sen.hoffset');
      let tm = Timer.now();
      print("znotraj drugega timerja");
      if (Cfg.get('app.sen.mode')){
        let underTempLimit = false;
        let aboveHumLimit = false;
        if ( temp < Cfg.get('app.lim.temp1') && Cfg.get('app.use.temp')){
          underTempLimit = true;
          if (temp < Cfg.get('app.lim.temp2')) {
            speed = 1;
            print ("1.Hitrost1 pod temp2: ", speed);
          }else{
            speed = 2;
            print ("1.Hitrost1 pod temp1: ", speed);
          }
        }else{
          if ( hum > Cfg.get('app.lim.hum1') && Cfg.get('app.use.hum')) {
            aboveHumLimit = true;
            if (hum > Cfg.get('app.lim.hum2')) {
              speed = 4;
              print ("1.Hitrost1 pod hum21: ", speed);
            }else{
              speed = 3;
              print ("1.Hitrost1 pod hum1: ", speed);
            }
          }  
        };

        // Objavi če je sprememba na underTemp ali aboveHUm
        if (aboveHumLimit !== Cfg.get('app.hum.above') || underTempLimit !== Cfg.get('app.temp.under')) {
          print ("Objavi če je sprememba na underTemp, aboveHUm");
          let msg = JSON.stringify({type: "sensor", userId: Cfg.get('app.user'), time: tm, temperature: temp, humidity: hum, oldSpeed: Cfg.get('app.old.speed'), aboveHumLimit: Cfg.get('app.hum.above'), underTempLimit: Cfg.get('app.temp.under')});
          print(topicpubstate, '->', msg);
          MQTT.pub(topicpubstate, msg, 1);
          //ce je sprememba meja in sta oba false potem objavi oz. spremeni speed nazaj na oldspeed
          if(!aboveHumLimit && !underTempLimit) {
            print ("Hitrost nazaj na oldSpeed: ", Cfg.get('app.old.speed'));
            let msg = JSON.stringify({userId: Cfg.get('app.user'), speed: Cfg.get('app.old.speed')});
            print(topicpubeventsfan, '->', msg);
            MQTT.pub(topicpubeventsfan, msg, 1);
          } 
        };

        Cfg.set({app: {hum: {above: aboveHumLimit}}});
        Cfg.set({app: {temp: {under: underTempLimit}}});        

        // če je evaluirana hitrost drugačna kot je bila poslana s strežnika potem popravi hitrost na bazi
        if (speed !== Cfg.get('app.sen.speed')) {
          print ("Hitrost drugic, ki se objavi na events/fan: ", speed);
          let msg = JSON.stringify({userId: Cfg.get('app.user'), speed: speed});
          print(topicpubeventsfan, '->', msg);
          MQTT.pub(topicpubeventsfan, msg, 1);
        }

      }  
        // če gre !underHumLimit && !underTempLimit --> nastavimo speed --> oldspeed 

    }, null);
    oldsentimer = newsentimer; 
    if (!Cfg.get('app.sen.mode')){
     // ko gre auto --> false: zbrisi timer,  
      Timer.del(newsentimer); 

    };

  }, null);


// reset modula nazaj na ap ko se zbriše baza oz. dobi sporocil {"reset"=true na commands subfolder reset}
  MQTT.sub(topicsubcommandreset, function(conn, topic, msg) {
    // {"reset":true}
        let obj = JSON.parse(msg) || {};
        print('Dobil sporocilo za reset');
        Cfg.set({wifi: {sta: {enable: false}}});
        Cfg.set({wifi: {sta: {ssid: ""}}});
        Cfg.set({wifi: {sta: {pass: ""}}});
        Cfg.set({wifi: {ap: {enable: true}}});
        Sys.reboot(10000);    
    }, null);
  


// RPC handler, ki omogoča export t in h vrednosti
/*
   RPC.addHandler('Status', function(){
    let t = dht.getTemp();
    let h = dht.getHumidity();
    return {temperature: t};
  });
*/