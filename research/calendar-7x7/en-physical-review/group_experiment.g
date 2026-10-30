Read("research/calendar-7x7/en-physical-review/action.g");;
t := Runtime();;
Print("degree\t",LargestMovedPoint(G),"\n");
Print("order\t",Size(G),"\n");
Print("order_ms\t",Runtime()-t,"\n");
QUIT;
