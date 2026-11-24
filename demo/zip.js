(function(root){
  'use strict';
  const utf8=new TextEncoder();
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
  function zip(entries){
    const chunks=[],directory=[];let offset=0,centralSize=0;
    if(entries.length>65535)throw new Error('ファイル数が多すぎます');
    for(const [path,input]of entries){
      if(!path || path.startsWith('/') || path.split('/').some(p=>p==='..'||p==='.') || /[\\\x00]/.test(path))throw new Error('不正なファイル名です');
      const name=utf8.encode(path),data=typeof input==='string'?utf8.encode(input):new Uint8Array(input);
      if(name.length>65535 || offset+data.length>0x7fffffff)throw new Error('ZIPが大きすぎます');
      const crc=crc32(data),local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
      l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);
      l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);
      const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);
      c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
      chunks.push(local,data);directory.push(central);offset+=local.length+data.length;centralSize+=central.length;
    }
    const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
    const result=new Uint8Array(offset+centralSize+22);let cursor=0;for(const part of [...chunks,...directory,end]){result.set(part,cursor);cursor+=part.length;}return result;
  }
  const api={zip,crc32};if(typeof module!=='undefined')module.exports=api;else root.AlbumZip=api;
})(typeof window!=='undefined'?window:globalThis);
