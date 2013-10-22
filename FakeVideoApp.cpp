/*
* FakeVideoApp.cpp
*
*  Created on: Agu 23, 2013
*      Author: cturgut
*/

// Based on example from:
//
// blocking_tcp_echo_client.cpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2011 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <boost/thread.hpp>
#include <boost/bind.hpp>
#include <boost/date_time/posix_time/posix_time.hpp>
#include <boost/asio.hpp>
using boost::optional;
using boost::asio::deadline_timer;
using boost::asio::ip::tcp;
using namespace std;

tcp::socket* tcp_client_socket = NULL;
int alarm_period = 1;
int md_mode = 0;
int video_mode = 1;

#define OPCODE_VIDEO_SRC_CHG	(1)
#define OPCODE_MD_MODE_CHG		(2)
#define OPCODE_ALARM_MSG		(3)

#define DAY_TV_MODE (1)
#define IR_MODE		(2)

#define MD_MODE_OFF	(0)
#define MD_MODE_1	(1)
#define MD_MODE_2	(2)

#define ALARM_TYPE_1	(1)
#define ALARM_TYPE_2	(2)

/* For every 1 second */
void periodicTimer (const boost::system::error_code& /*e*/, boost::asio::deadline_timer* t)
{
   static long int counter_heart_beat = 0;
   unsigned char buffer[5];
   size_t write_length = 0;
   boost::system::error_code ec;

   counter_heart_beat++;

   //send alarm at every "alarm_period" according to "md_mode"
   if ((tcp_client_socket != NULL) && (counter_heart_beat % alarm_period == 0))
   {
       if (md_mode != MD_MODE_OFF)
       {
           buffer[0] = OPCODE_ALARM_MSG;
           buffer[1] = md_mode;

           write_length = boost::asio::write((*tcp_client_socket), boost::asio::buffer(buffer, 2),
               boost::asio::transfer_all(), ec);

           usleep(100 * 1000);
           if (ec || write_length != 2)
           {
               cout << "** MotionDetector: alarm_sent_error FAIL!" << endl;
           }
           else
           {
               cout << "** MotionDetector: alarm is sent" << endl;
           }

       }
   }
   else if (tcp_client_socket == NULL)
   {
       cout << "** MotionDetector: NO valid socket which is connected to SystemMgr " << endl;
   }

   //set timer again and return
   t->expires_at(t->expires_at() + boost::posix_time::seconds(1));
   t->async_wait(boost::bind(periodicTimer, boost::asio::placeholders::error, t));
   return;
}

int main (int argc, char* argv[])
{
   bool return_value = false;
   string test = "";
   unsigned char buffer[5];
   int received_packet_size = 0;
   char opcode = 0;
   char data = 0;
   size_t write_length = 0;
   size_t read_length = 0;
   boost::system::error_code ec;

   if (argc != 3)
   {
       std::cerr << "Usage: app <host> <port>\n";
       return 1;
   }

   cout << "*** Fake Video App is Started ***" << endl;

   memset(&(buffer[0]), 0, 5);

   boost::asio::io_service io_service;

   tcp::resolver resolver(io_service);
   tcp::resolver::query query(tcp::v4(), argv[1], argv[2]);
   tcp::resolver::iterator iterator = resolver.resolve(query);

   tcp::socket socket_(io_service);

   tcp_client_socket = &socket_;

   //wait to connect
   do
   {
       try
       {
           boost::asio::connect(socket_, iterator);
           return_value = true;
           cout << "** VideoAppMain: connected to SystemMgr " << endl;
       }
       catch (std::exception& e)
       {
           cout << "** VideoAppMain: could not connect to SystemMgr @IN while loop" << endl;
           std::cerr << "Exception connect: " << e.what() << "\n";
           usleep(1 * 1000 * 1000);
           return_value = false;
       }
   } while (return_value == false);

   boost::asio::io_service io;
   boost::asio::deadline_timer t(io, boost::posix_time::seconds(1));
   t.async_wait(boost::bind(periodicTimer, boost::asio::placeholders::error, &t));
   boost::thread thread1(boost::bind(&boost::asio::io_service::run, &io));

   /*
    * Start Fake Video App
    *
    * break infinite loop at exit condition
    */
   while (1)
   {
       //try to read configuration data
       read_length = boost::asio::read((socket_),
           boost::asio::buffer((char*) &(buffer[0]), (size_t) 2),
           boost::asio::transfer_at_least(2), ec);

       if (!ec && read_length == 2)
       {
           cout << "** VideoAppMain: configuration message is received" << endl;

           opcode = buffer[0];
           data = buffer[1];

           switch (opcode)
           {
               case OPCODE_VIDEO_SRC_CHG:
                   if (data == DAY_TV_MODE)
                   {
                       cout << "** VideoAppMain: DAY TV MODE ** " << endl;
                       video_mode = DAY_TV_MODE;
                   }
                   else if (data == IR_MODE)
                   {
                       cout << "** VideoAppMain: IR MODE ** " << endl;
                       video_mode = IR_MODE;
                   }

                   buffer[0] = OPCODE_VIDEO_SRC_CHG;
                   buffer[1] = (char) video_mode;

                   write_length = boost::asio::write((socket_), boost::asio::buffer(buffer, 2),
                       boost::asio::transfer_all(), ec);

                   usleep(100 * 1000);
                   if (ec || write_length != 2)
                   {
                       cout << "** VideoAppMain: error on ACK sending" << endl;
                   }
                   else
                   {
                       cout << "** VideoAppMain: ACK is sent - OPCODE_VIDEO_SRC_CHG" << endl;
                   }

                   break;

               case OPCODE_MD_MODE_CHG:
                   if (data == MD_MODE_OFF)
                   {
                       cout << "** VideoAppMain: MD Mode: OFF ** " << endl;
                       md_mode = MD_MODE_OFF;
                   }
                   else if (data == MD_MODE_1)
                   {
                       cout << "** VideoAppMain: MD Mode: 1 ** " << endl;
                       md_mode = MD_MODE_1;
                       alarm_period = 10;
                   }
                   else if (data == MD_MODE_2)
                   {
                       cout << "** VideoAppMain: MD Mode: 2 ** " << endl;
                       md_mode = MD_MODE_2;
                       alarm_period = 30;
                   }

                   buffer[0] = OPCODE_MD_MODE_CHG;
                   buffer[1] = (char) md_mode;

                   write_length = boost::asio::write((socket_), boost::asio::buffer(buffer, 2),
                       boost::asio::transfer_all(), ec);

                   usleep(100 * 1000);
                   if (ec || write_length != 2)
                   {
                       cout << "** VideoAppMain: error on ACK sending" << endl;
                   }
                   else
                   {
                       cout << "** VideoAppMain: ACK is sent - OPCODE_VIDEO_SRC_CHG" << endl;
                   }

                   break;
           }
       }
       else if (ec)
       {

           cout << "** VideoAppMain: try to re-connect" << endl;

           socket_.shutdown(boost::asio::ip::tcp::socket::shutdown_both, ec);
           socket_.close(ec);

           //wait to connect
           do
           {
               try
               {
                   boost::asio::connect(socket_, iterator);
                   return_value = true;
               }
               catch (std::exception& e)
               {
                   cout << "** VideoAppMain: could not connect to SystemMgr @IN while loop"
                                   << endl;
                   std::cerr << "Exception connect: " << e.what() << "\n";
                   usleep(1 * 1000 * 1000);
                   return_value = false;
               }
           } while (return_value == false);
       }
   }

   socket_.shutdown(boost::asio::ip::tcp::socket::shutdown_both, ec);
   socket_.close(ec);

   delete tcp_client_socket;
   tcp_client_socket = NULL;

   return 0;
}

