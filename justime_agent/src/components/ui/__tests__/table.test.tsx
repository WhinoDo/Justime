import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '../table'

describe('Table Components', () => {
  it('应该渲染完整的表格结构', () => {
    render(
      <Table>
        <TableCaption>表格标题</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>年龄</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>张三</TableCell>
            <TableCell>25</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>总计</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    expect(screen.getByText('表格标题')).toBeInTheDocument()
    expect(screen.getByText('姓名')).toBeInTheDocument()
    expect(screen.getByText('年龄')).toBeInTheDocument()
    expect(screen.getByText('张三')).toBeInTheDocument()
    expect(screen.getByText('总计')).toBeInTheDocument()
  })

  it('Table 应该支持自定义 className', () => {
    render(
      <Table className="custom-table">
        <TableBody>
          <TableRow>
            <TableCell>内容</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(document.querySelector('.custom-table')).toBeInTheDocument()
  })

  it('TableRow 应该支持自定义 className', () => {
    render(
      <Table>
        <TableBody>
          <TableRow className="custom-row">
            <TableCell>内容</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(document.querySelector('.custom-row')).toBeInTheDocument()
  })

  it('TableHead 应该支持自定义 className', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="custom-head">标题</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    )

    expect(document.querySelector('.custom-head')).toBeInTheDocument()
  })

  it('TableCell 应该支持自定义 className', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="custom-cell">内容</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(document.querySelector('.custom-cell')).toBeInTheDocument()
  })
})
