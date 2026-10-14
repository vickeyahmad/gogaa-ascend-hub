export type OrderStatus = 'Pending Payment' | 'Paid' | 'Processing' | 'Completed' | 'Failed';
export const previewOrders: {id:string; name:string; email:string; initials:string; date:string; amount:string; status:OrderStatus; tone:string}[] = [
 {id:'GB-1048',name:'Ahmed Khan',email:'ahmed@example.com',initials:'AK',date:'Oct 14, 2026',amount:'4,500',status:'Completed',tone:'violet'},
 {id:'GB-1047',name:'Sara Ali',email:'sara@example.com',initials:'SA',date:'Oct 14, 2026',amount:'2,999',status:'Processing',tone:'pink'},
 {id:'GB-1046',name:'Usman Malik',email:'usman@example.com',initials:'UM',date:'Oct 13, 2026',amount:'7,500',status:'Pending Payment',tone:'orange'},
 {id:'GB-1045',name:'Ayesha Noor',email:'ayesha@example.com',initials:'AN',date:'Oct 13, 2026',amount:'1,800',status:'Paid',tone:'green'},
 {id:'GB-1044',name:'Bilal Hassan',email:'bilal@example.com',initials:'BH',date:'Oct 12, 2026',amount:'3,200',status:'Failed',tone:'blue'},
 {id:'GB-1043',name:'Hina Raza',email:'hina@example.com',initials:'HR',date:'Oct 12, 2026',amount:'5,400',status:'Completed',tone:'pink'},
];
