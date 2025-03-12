---
title: "VS Code 设置：在 Windows 右键菜单中添加“Open with VS Code”选项"
date: 2025-03-12
draft: false
tags: ["VS Code", ".bat"]
categories: ["VS-Code"]
author: "Zhenzhuo Shan"

weight: 1
---
# 添加 VS Code 右键菜单
可以手动修改注册表，也可以使用`.bat`(批处理)文件自动添加。

## 一、手动修改注册表
### 步骤
1. 打开注册表编辑器，路径为：`计算机\HKEY_CLASSES_ROOT\Directory\shell\Open with VS Code`
2. 新建一个名为`command`的字符串值，值为`"C:\Program Files\Microsoft VS Code\Code.exe" "%V"`

## 二、使用批处理添加
### （一）步骤
1. 新建一个`.bat`文件，内容如下（注意修改 VS code 安装路径）：
```bat 
@echo off
REG ADD "HKEY_CLASSES_ROOT\Directory\Background\shell\Open with VS Code" /ve /t REG_SZ /d "open here with VS Code" /f
REG ADD "HKEY_CLASSES_ROOT\Directory\Background\shell\Open with VS Code\command" /ve /t REG_SZ /d "\"D:\software\Microsoft VS Code\Code.exe\" \"%%V\"" /f
echo VS Code Sucess!
pause
```
2. 右键点击该`.bat`文件，选择`以管理员身份运行`；
3. 运行完毕后，右键点击文件夹空白处，看看是否出现 `open here with VS Code` 选项。

### （二）代码解析
#### 1. `.bat`文件的基本概念
- `.bat`(Batch file , 批处理文件) 是 `Windows` 下的一种脚本文件，常用于自动化执行多个命令。
- 批处理脚本在 `cmd.exe` 终端中运行，每行代表一条命令，依次执行。
- `.bat` 文件可以用于文件操作、系统配置、程序自动化等任务。

#### 2. `.bat`文件的语法
- `@echo off`：关闭命令回显，不显示执行的命令，只显示执行结果。
- `REG ADD`：向 `Windows` 注册表添加新项或修改现有项。
- `echo`：显示后面的文本
- `pause`：暂停批处理脚本的执行，等待用户按下任意键继续

#### 3. `REG ADD`命令的语法
(1) 第 2 行`REG ADD` 
- `HKEY_CLASSES_ROOT\Directory\Background\shell\Open with VS Code`：注册表中右键菜单的路径，表示文件夹背景的右键菜单项。
- `/ve`：表示默认值（即该键的名称为空）。
- `/t REG_SZ`：将该键的类型设置为 字符串（REG_SZ）。
- `/d "open here with VS Code"`：将菜单显示名称设置为 `"open here with VS Code"`。
- `/f`：强制执行，无需用户确认。
(2) 第 3 行`REG ADD`
- 设置的是点击`"open here with VS Code"`后执行的命令
- `HKEY_CLASSES_ROOT\Directory\Background\shell\Open with VS Code\command`：这个注册表项存储的是执行的命令。
- `D:\software\Microsoft VS Code\Code.exe`：`VS Code` 可执行文件的路径（需要根据实际安装路径修改）。
- `%%V`：代表当前文件夹路径，`VS Code` 启动时会打开这个路径。