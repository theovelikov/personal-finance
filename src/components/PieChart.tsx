import React, { useState, useCallback, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js'
Chart.register(ArcElement, Tooltip, Legend);

type txn = {
    account_id: string,
    date: string,
    amount: number,
    name: string,
    category: string[],
    payment_channel: string,
}

type Props = {
    data: txn[],
    options?: object 
}

function PieChart({data}: Props) {
    const getAmountsByCategory = () => {
        const categories: any = {};
        data.forEach((txn: txn) =>  {
            if (categories[txn.category[0]] === undefined) {
                categories[txn.category[0]] = txn.amount;
            } else {
                categories[txn.category[0]] += txn.amount
            }
        })
        return categories;
    }

    console.log(getAmountsByCategory())
    const pieData = {
            datasets: [{
            label: 'Spending by Category',
            data: Object.values(getAmountsByCategory()),
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 206, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)',
              ],
              borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)',
              ],
              borderWidth: 1,
        }],
        labels: Object.keys(getAmountsByCategory())
    }
      
    return (
        <Pie 
            data={pieData}
            options={{maintainAspectRatio: false}}
        />
    )
}

export default PieChart;